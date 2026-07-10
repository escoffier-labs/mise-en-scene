import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { layoutScene } from "./layout.ts";
import { editBlock, editEdge } from "./types.ts";

test("edits are immutable and survive view-only relayout", () => {
  const original = extractScene("A -> B: calls", "engineer").document;
  const edited = editEdge(editBlock(original, original.blocks[0].id, { label: "Client" }), original.edges[0].id, "requests");
  const sequence = layoutScene(edited, "sequence");
  assert.equal(original.blocks[0].label, "A");
  assert.equal(sequence.blocks[0].label, "Client");
  assert.equal(sequence.edges[0].label, "requests");
  assert.deepEqual(sequence.blocks.map((b) => b.id), edited.blocks.map((b) => b.id));
});
