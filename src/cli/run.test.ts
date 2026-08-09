import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "../scene/extract.ts";
import { runCli, type Renderers } from "./run.ts";

const source = "Browser -> API: sends request\nAPI -> Database: reads rows";
const scene = extractScene(source, "engineer").document;

const renderers: Renderers = {
  renderSvg: () => "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
  renderHtml: () => "<!doctype html><html></html>",
  renderWalkthrough: () => "<!doctype html><html></html>",
  renderJson: (doc, view) => `${JSON.stringify({ ...doc, ...(view ? { view } : {}) }, null, 2)}\n`,
};

test("runCli --help prints usage", () => {
  let out = "";
  const result = runCli(["--help"], { writeStdout: (d) => { out += String(d); } });
  assert.equal(result.ok, true);
  assert.match(out, /Usage: mise-en-scene/);
});

test("runCli exports SVG through injectable renderer", () => {
  let written = "";
  const result = runCli(["scene.json", "-o", "out.svg"], {
    ...renderers,
    loadScene: () => ({ ok: true, scene, source: "json" }),
    writeFile: (_path, data) => { written = String(data); },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.format, "svg");
  assert.equal(result.outputPath, "out.svg");
  assert.match(written, /^<svg/);
});

test("runCli exports PNG via raster hook", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  let written: Buffer | null = null;
  const result = runCli(["scene.json", "-f", "png", "-o", "out.png"], {
    ...renderers,
    loadScene: () => ({ ok: true, scene, source: "json" }),
    rasterPng: () => ({ ok: true, png }),
    writeFile: (_path, data) => { written = Buffer.isBuffer(data) ? data : Buffer.from(data); },
  });
  assert.equal(result.ok, true);
  assert.ok(written);
  assert.deepEqual(written, png);
});

test("runCli requires output path for PNG", () => {
  const result = runCli(["scene.json", "-f", "png"], {
    ...renderers,
    loadScene: () => ({ ok: true, scene, source: "json" }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /requires -o/);
});

test("runCli writes JSON layout for the requested view", () => {
  let written = "";
  const result = runCli(["scene.json", "-f", "json", "--view", "sequence", "-o", "out.json"], {
    ...renderers,
    renderJson: (doc, view) => {
      assert.equal(view, "sequence");
      return JSON.stringify({ ...doc, view }, null, 2);
    },
    loadScene: () => ({ ok: true, scene, source: "json" }),
    writeFile: (_path, data) => { written = String(data); },
  });
  assert.equal(result.ok, true);
  assert.match(written, /"view": "sequence"/);
});

test("runCli surfaces load errors", () => {
  const result = runCli(["missing.json"], {
    ...renderers,
    loadScene: () => ({ ok: false, error: "cannot read input: missing" }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.exitCode, 1);
  assert.match(result.error, /cannot read input/);
});
