import assert from "node:assert/strict";
import test from "node:test";
import { formatFromPath, parseArgs, resolveFormat, usage } from "./args.ts";

test("parseArgs reads input, output, format, view, and flags", () => {
  const args = parseArgs([
    "export",
    "scene.json",
    "-o",
    "out.png",
    "-f",
    "png",
    "--view",
    "sequence",
    "--audience",
    "exec",
    "--review",
    "--chrome-path",
    "/usr/bin/google-chrome",
    "--scale",
    "1",
  ]);
  assert.equal(args.error, undefined);
  assert.equal(args.inputPath, "scene.json");
  assert.equal(args.outputPath, "out.png");
  assert.equal(args.format, "png");
  assert.equal(args.view, "sequence");
  assert.equal(args.audience, "exec");
  assert.equal(args.review, true);
  assert.equal(args.chromePath, "/usr/bin/google-chrome");
  assert.equal(args.scale, 1);
});

test("parseArgs accepts positional output when -o is omitted", () => {
  const args = parseArgs(["in.json", "out.svg"]);
  assert.equal(args.inputPath, "in.json");
  assert.equal(args.outputPath, "out.svg");
});

test("parseArgs rejects unknown options and bad formats", () => {
  assert.match(parseArgs(["--nope"]).error ?? "", /unknown option/);
  assert.match(parseArgs(["-f", "pdf"]).error ?? "", /unsupported format/);
  assert.match(parseArgs(["--view", "graph"]).error ?? "", /unsupported view/);
});

test("resolveFormat prefers explicit format, then extension, else svg", () => {
  assert.equal(resolveFormat({ help: false, audience: "engineer", review: false, scale: 2, format: "html" }), "html");
  assert.equal(resolveFormat({ help: false, audience: "engineer", review: false, scale: 2, outputPath: "x.png" }), "png");
  assert.equal(resolveFormat({ help: false, audience: "engineer", review: false, scale: 2, outputPath: "walk.html" }), "walkthrough");
  assert.equal(resolveFormat({ help: false, audience: "engineer", review: false, scale: 2 }), "svg");
  const pdf = resolveFormat({ help: false, audience: "engineer", review: false, scale: 2, outputPath: "x.pdf" });
  assert.ok(typeof pdf === "object" && "error" in pdf);
  assert.match(pdf.error, /PDF export is not available/);
});

test("formatFromPath maps common extensions", () => {
  assert.equal(formatFromPath("a.SVG"), "svg");
  assert.equal(formatFromPath("a.png"), "png");
  assert.equal(formatFromPath("scene.html"), "html");
  assert.equal(formatFromPath("brigade-walkthrough.html"), "walkthrough");
  assert.equal(formatFromPath("a.pdf"), undefined);
});

test("usage mentions headless SVG and Chromium PNG", () => {
  const text = usage();
  assert.match(text, /mise-en-scene/);
  assert.match(text, /React SSR/);
  assert.match(text, /CHROME_PATH/);
});
