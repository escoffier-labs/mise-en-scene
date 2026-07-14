import assert from "node:assert/strict";
import test from "node:test";
import { parseYaml } from "./yaml.ts";
import { extractScene } from "./extract.ts";

const petstore = `openapi: 3.1.0
info:
  title: Pet API
  version: "1.0"
paths:
  /pets:
    get:
      tags: [Pets]
      summary: List pets
    post:
      tags:
        - Pets
      summary: Create a pet
  /pets/{petId}:
    get:
      tags: [Pets]
      description: |
        Return a single pet
        by its identifier.
`;

test("parses nested mappings, flow and block sequences", () => {
  const doc = parseYaml(petstore) as any;
  assert.equal(doc.openapi, "3.1.0");
  assert.equal(doc.info.title, "Pet API");
  assert.equal(doc.info.version, "1.0");
  assert.deepEqual(doc.paths["/pets"].get.tags, ["Pets"]);
  assert.deepEqual(doc.paths["/pets"].post.tags, ["Pets"]);
  assert.equal(doc.paths["/pets"].get.summary, "List pets");
});

test("parses block scalars into folded text", () => {
  const doc = parseYaml(petstore) as any;
  assert.equal(doc.paths["/pets/{petId}"].get.description, "Return a single pet\nby its identifier.");
});

test("parses quoted scalars and comments", () => {
  const doc = parseYaml(`a: "quoted: value"  # trailing comment\nb: 'it''s fine'\nc: 42\nd: true`) as any;
  assert.equal(doc.a, "quoted: value");
  assert.equal(doc.b, "it's fine");
  assert.equal(doc.c, 42);
  assert.equal(doc.d, true);
});

test("parses sequences of mappings", () => {
  const doc = parseYaml(`servers:\n  - url: https://api.example.com\n    description: Production\n  - url: https://staging.example.com`) as any;
  assert.deepEqual(doc.servers, [
    { url: "https://api.example.com", description: "Production" },
    { url: "https://staging.example.com" },
  ]);
});

test("OpenAPI YAML extracts tags and operations like JSON", () => {
  const result = extractScene(petstore, "customer");
  assert.equal(result.document.source.kind, "openapi");
  assert.equal(result.document.title, "Pet API");
  assert.ok(result.document.blocks.some((b) => b.label === "Pets"));
  assert.ok(result.document.blocks.some((b) => b.label === "GET /pets"));
  const op = result.document.blocks.find((b) => b.label === "GET /pets")!;
  const fact = result.document.facts.find((f) => op.factIds.includes(f.id))!;
  assert.equal(petstore.slice(fact.start, fact.end), "List pets");
});

test("prose that is not OpenAPI YAML falls back to text extraction", () => {
  const result = extractScene("Browser -> API: sends request\nAPI -> Database: reads rows", "engineer");
  assert.equal(result.document.source.kind, "text");
  assert.deepEqual(result.document.edges.map((e) => e.label), ["sends request", "reads rows"]);
});
