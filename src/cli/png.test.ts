import assert from "node:assert/strict";
import test from "node:test";
import { PNG_SCALE, SCENE_HEIGHT, SCENE_WIDTH } from "../scene/raster.ts";
import { rasterSvgToPng } from "./png.ts";

const tinySvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#0d1014"/></svg>';

test("rasterSvgToPng fails clearly when Chromium is missing", () => {
  const result = rasterSvgToPng(tinySvg, {}, { findChrome: () => null });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /CHROME_PATH/);
});

test("rasterSvgToPng writes HTML and invokes Chromium with screenshot flags", () => {
  const writes: Array<{ path: string; data: string | Buffer }> = [];
  let removed = false;
  const result = rasterSvgToPng(
    tinySvg,
    { scale: PNG_SCALE },
    {
      findChrome: () => "/usr/bin/fake-chrome",
      mkTempDir: () => "/tmp/mise-png-test",
      writeFile: (path, data) => writes.push({ path, data }),
      readFile: () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      removeDir: () => {
        removed = true;
      },
      runChrome: (bin, args) => {
        assert.equal(bin, "/usr/bin/fake-chrome");
        assert.ok(args.includes("--headless=new"));
        assert.ok(args.includes(`--force-device-scale-factor=${PNG_SCALE}`));
        assert.ok(args.includes(`--window-size=${SCENE_WIDTH},${SCENE_HEIGHT}`));
        assert.ok(args.some((a) => a.startsWith("--screenshot=")));
        assert.ok(args.some((a) => a.startsWith("file://")));
        return { status: 0, pid: 0, output: [], stdout: Buffer.from(""), stderr: Buffer.from(""), signal: null };
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(removed, true);
  assert.equal(writes.length, 1);
  assert.match(String(writes[0].data), /<!doctype html>/i);
  assert.match(String(writes[0].data), /width="1280"/);
});

test("rasterSvgToPng surfaces Chromium launch failures", () => {
  const result = rasterSvgToPng(
    tinySvg,
    {},
    {
      findChrome: () => "/usr/bin/fake-chrome",
      mkTempDir: () => "/tmp/mise-png-test",
      writeFile: () => {},
      removeDir: () => {},
      runChrome: () => ({
        status: null,
        pid: 0,
        output: [],
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        signal: null,
        error: new Error("spawn ENOENT"),
      }),
    },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /failed to launch Chromium/);
});
