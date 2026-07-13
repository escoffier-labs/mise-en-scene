import assert from "node:assert/strict";
import test from "node:test";
import { sizedSvg, svgToDataUrl, SCENE_HEIGHT, SCENE_WIDTH } from "./raster.ts";

test("svgToDataUrl encodes the scene and round-trips", () => {
  const svg = '<svg viewBox="0 0 1280 780"><text>A -> B</text></svg>';
  const url = svgToDataUrl(svg);
  assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
  assert.equal(decodeURIComponent(url.replace(/^data:image\/svg\+xml;charset=utf-8,/, "")), svg);
});

test("sizedSvg injects explicit pixel dimensions on the root element", () => {
  const svg = sizedSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 780"></svg>');
  assert.match(svg, new RegExp(`^<svg width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}"`));
});
