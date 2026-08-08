import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { SCENE_LIMITS } from "./types.ts";
import { validateSceneDocument } from "./validate.ts";

test("arrow-heavy and OpenAPI-heavy extraction stay within model caps", () => {
  const arrows = Array.from({ length: SCENE_LIMITS.facts + 2 }, (_, i) => `A -> B: step ${i}`).join("\n");
  const arrowDoc = extractScene(arrows, "engineer").document;
  assert.equal(arrowDoc.facts.length, SCENE_LIMITS.facts);
  assert.ok(arrowDoc.blocks.length <= SCENE_LIMITS.blocks);
  assert.ok(arrowDoc.edges.length <= SCENE_LIMITS.edges);
  assert.equal(validateSceneDocument(arrowDoc).ok, true);

  const paths: Record<string, object> = {};
  for (let i = 0; i < SCENE_LIMITS.blocks; i++) {
    paths[`/r${i}`] = { get: { tags: [`Tag${i}`], summary: `Read ${i}` } };
  }
  const openapiDoc = extractScene(JSON.stringify({ openapi: "3.1.0", info: { title: "Wide API" }, paths }), "engineer").document;
  assert.ok(openapiDoc.blocks.length <= SCENE_LIMITS.blocks);
  assert.ok(openapiDoc.facts.length <= SCENE_LIMITS.facts);
  assert.ok(openapiDoc.edges.length <= SCENE_LIMITS.edges);
  assert.equal(validateSceneDocument(openapiDoc).ok, true);
});

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

test("Markdown bullets attach to their nearest heading", () => {
  const result = extractScene("# API\n- Accepts requests\n# Database\n- Stores rows\nAPI -> Database: writes", "engineer");
  const api = result.document.blocks.find((block) => block.label === "API")!;
  const database = result.document.blocks.find((block) => block.label === "Database")!;
  assert.ok(api.factIds.some((id) => result.document.facts.find((fact) => fact.id === id)?.text === "Accepts requests"));
  assert.ok(database.factIds.some((id) => result.document.facts.find((fact) => fact.id === id)?.text === "Stores rows"));
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

test("inherited openapi and paths properties do not count as OpenAPI", () => {
  // A __proto__ mapping would otherwise satisfy OpenAPI via the prototype chain.
  const poisoned = `__proto__:
  openapi: 3.1.0
  paths:
    /x:
      get:
        summary: ok
  info:
    title: Proto
    version: "1.0"`;
  const result = extractScene(poisoned, "engineer");
  assert.equal(result.document.source.kind, "text");
  assert.notEqual(result.document.source.kind, "openapi");
});
