import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "../scene/extract.ts";
import { loadSceneFromText } from "./loadScene.ts";

const source = "Browser -> API: sends request\nAPI -> Database: reads rows";

test("loadSceneFromText extracts arrow source into a scene", () => {
  const result = loadSceneFromText(source, "engineer");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.source, "extract");
  assert.ok(result.scene.blocks.length >= 3);
  assert.ok(result.scene.edges.length >= 2);
});

test("loadSceneFromText validates saved scene JSON", () => {
  const scene = extractScene(source, "engineer").document;
  const result = loadSceneFromText(JSON.stringify(scene), "student");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.source, "json");
  assert.equal(result.scene.audience, "engineer");
});

test("loadSceneFromText rejects invalid scene JSON with schemaVersion", () => {
  const result = loadSceneFromText(JSON.stringify({ schemaVersion: 1, title: 1 }), "engineer");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /invalid scene JSON/);
});

test("loadSceneFromText rejects empty input", () => {
  const result = loadSceneFromText("   ", "engineer");
  assert.equal(result.ok, false);
});
