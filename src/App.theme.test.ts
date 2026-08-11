import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("App wires scene theme persistence, control, exports, and video canvas", () => {
  const app = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

  assert.match(app, /["']mise-theme["']/);
  assert.match(app, /\bisSceneThemeId\b/);
  assert.match(app, /aria-label=["']Scene theme["']/);
  assert.match(app, /<SceneSvg\b[^>]*\btheme=\{theme\}/);
  assert.match(app, /\bstandaloneHtml\s*\(\s*scene\s*,\s*theme\s*\)/);
  assert.match(app, /\bstandaloneWalkthrough\s*\(\s*scene\s*,\s*theme\s*\)/);
  assert.match(app, /\bstandaloneSvg\s*\([\s\S]*?theme\s*\)/);
  assert.match(app, /getSceneTheme\s*\(\s*theme\s*\)\s*\.\s*bg/);
  assert.match(app, /\bencodeShareEnvelope\b/);
  assert.match(app, /Copy share link/);
  assert.match(app, /Copy embed link/);
});
