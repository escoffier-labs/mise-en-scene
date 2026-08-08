import assert from "node:assert/strict";
import test from "node:test";
import { SCENE_LIMITS } from "./types.ts";
import { validateSceneDocument } from "./validate.ts";

function fixture(): any {
  return {
    schemaVersion: 1,
    title: "Example",
    subtitle: "Engineer view",
    summary: "A small scene",
    audience: "engineer",
    view: "architecture",
    source: { kind: "text", text: "A -> B: calls" },
    facts: [{ id: "fact", text: "A calls B", start: 0, end: 12 }],
    terms: ["A", "B"],
    blocks: [
      { id: "a", label: "A", kind: "service", detail: "A", factIds: ["fact"], x: 0, y: 0, w: 100, h: 80 },
      { id: "b", label: "B", kind: "service", detail: "B", factIds: [], x: 200, y: 0, w: 100, h: 80 },
    ],
    edges: [{ id: "a-b", from: "a", to: "b", label: "calls", factIds: ["fact"] }],
    warnings: [],
  };
}

test("accepts a schema version 1 scene", () => {
  assert.equal(validateSceneDocument(fixture()).ok, true);
});

test("rejects dangling endpoints without replacing the document", () => {
  const value = fixture();
  value.edges[0].to = "missing";
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "edges[0].to references an unknown block" });
});

test("rejects duplicate block IDs", () => {
  const value = fixture();
  value.blocks[1].id = "a";
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "blocks[1].id must be unique" });
});

test("rejects non-string terms", () => {
  const value = fixture();
  value.terms = ["A", 2];
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "terms[1] must be a string" });
});

test("rejects non-string warnings", () => {
  const value = fixture();
  value.warnings = [{ message: "bad" }];
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "warnings[0] must be a string" });
});

test("rejects warnings above the model cap", () => {
  const value = fixture();
  value.warnings = Array.from({ length: SCENE_LIMITS.warnings + 1 }, (_, i) => `warning ${i}`);
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "warnings exceeds the size limit" });
});

test("rejects fact ranges past the source length", () => {
  const value = fixture();
  value.facts[0].end = value.source.text.length + 1;
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "facts[0] is invalid" });
});

test("accepts unavailable fact offsets as -1,-1", () => {
  const value = fixture();
  value.facts[0].start = -1;
  value.facts[0].end = -1;
  assert.equal(validateSceneDocument(value).ok, true);
});

test("accepts fact end exactly at source length", () => {
  const value = fixture();
  value.facts[0].start = 0;
  value.facts[0].end = value.source.text.length;
  assert.equal(validateSceneDocument(value).ok, true);
});

test("rejects mixed unavailable fact start with end 0", () => {
  const value = fixture();
  value.facts[0].start = -1;
  value.facts[0].end = 0;
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "facts[0] is invalid" });
});

test("rejects mixed unavailable fact start with end at source length", () => {
  const value = fixture();
  value.facts[0].start = -1;
  value.facts[0].end = value.source.text.length;
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "facts[0] is invalid" });
});

test("rejects mixed unavailable fact start with end past source length", () => {
  const value = fixture();
  value.facts[0].start = -1;
  value.facts[0].end = value.source.text.length + 1;
  assert.deepEqual(validateSceneDocument(value), { ok: false, error: "facts[0] is invalid" });
});
