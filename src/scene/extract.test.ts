import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";

test("plain text arrows create source-specific blocks and evidence", () => {
  const source = "Browser -> API: sends request\nAPI -> Database: reads rows";
  const result = extractScene(source, "engineer");
  assert.deepEqual(result.document.blocks.map((b) => b.label), ["Browser", "API", "Database"]);
  assert.deepEqual(result.document.edges.map((e) => e.label), ["sends request", "reads rows"]);
  const fact = result.document.facts.find((f) => f.id === result.document.edges[0].factIds[0])!;
  assert.equal(source.slice(fact.start, fact.end), "Browser -> API: sends request");
});

test("plain text fallback is explicit and stable", () => {
  const a = extractScene("A short note.", "exec");
  const b = extractScene("A short note.", "exec");
  assert.deepEqual(a.document.blocks.map((block) => block.id), b.document.blocks.map((block) => block.id));
  assert.match(a.document.warnings[0], /fallback/i);
});

test("OpenAPI JSON creates tags and operations", () => {
  const source = JSON.stringify({ openapi: "3.1.0", info: { title: "Pet API" }, paths: { "/pets": { get: { tags: ["Pets"], summary: "List pets" } } } });
  const result = extractScene(source, "customer");
  assert.equal(result.document.source.kind, "openapi");
  assert.ok(result.document.blocks.some((b) => b.label === "Pets"));
  assert.ok(result.document.blocks.some((b) => b.label === "GET /pets"));
});

test("OpenAPI without operations uses fallback", () => {
  const result = extractScene(JSON.stringify({ openapi: "3.1.0", paths: {} }), "engineer");
  assert.match(result.document.warnings[0], /no operations/i);
});
