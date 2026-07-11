import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { layoutScene } from "./layout.ts";

test("layout is deterministic and architecture uses kind columns", () => {
  const doc = extractScene("User -> API: calls\nAPI -> Database: reads", "engineer").document;
  const a = layoutScene(doc, "architecture"); const b = layoutScene(doc, "architecture");
  assert.deepEqual(a.blocks, b.blocks);
  assert.ok(a.blocks.find((x) => x.label === "User")!.x < a.blocks.find((x) => x.label === "API")!.x);
  assert.ok(a.blocks.find((x) => x.label === "API")!.x < a.blocks.find((x) => x.label === "Database")!.x);
});

test("sequence layout keeps participants unique and orders messages", () => {
  const doc = extractScene("A -> B: first\nB -> A: second", "engineer").document;
  const laid = layoutScene(doc, "sequence");
  assert.equal(new Set(laid.blocks.map((b) => b.id)).size, laid.blocks.length);
  assert.deepEqual(laid.edges.map((e) => e.order), [0, 1]);
});
