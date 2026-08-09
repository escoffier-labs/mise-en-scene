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
});

test("App shares URL-encoded scene state and guards localStorage access", () => {
  const app = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");
  const main = readFileSync(fileURLToPath(new URL("./main.tsx", import.meta.url)), "utf8");

  assert.match(app, /\bencodeShareEnvelope\b/);
  assert.match(app, /\bdecodeShareEnvelope\b/);
  assert.match(app, /\bbuildStudioShareUrl\b/);
  assert.match(app, /\bbuildEmbedShareUrl\b/);
  assert.match(app, /Share link/);
  assert.match(app, /Embed link/);
  assert.match(app, /function readStorage\b/);
  assert.match(app, /function writeStorage\b/);
  assert.match(app, /extractScene\(readStorage\(["']mise-source["']\)/);
  assert.match(app, /writeStorage\(["']mise-source["']/);
  assert.match(app, /writeStorage\(["']mise-theme["']/);
  assert.match(main, /\bisEmbedMode\b/);
  assert.match(main, /\bEmbedView\b/);
});
