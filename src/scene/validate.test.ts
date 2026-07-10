import assert from "node:assert/strict";
import test from "node:test";
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
