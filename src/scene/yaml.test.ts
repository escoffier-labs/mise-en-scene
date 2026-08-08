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
  assert.equal(doc.servers.length, 2);
  assert.equal(Object.getPrototypeOf(doc.servers[0]), null);
  assert.equal(doc.servers[0].url, "https://api.example.com");
  assert.equal(doc.servers[0].description, "Production");
  assert.equal(doc.servers[1].url, "https://staging.example.com");
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

function assertRejectsUnsupported(source: string, label: string) {
  assert.equal(parseYaml(source), null, `${label}: parseYaml must return null`);
  const result = extractScene(source, "engineer");
  assert.equal(result.document.source.kind, "text", `${label}: must fall back to plain-text extraction`);
  assert.notEqual(result.document.source.kind, "openapi", `${label}: must not masquerade as OpenAPI`);
}

test("aliases and anchors reject instead of partial OpenAPI", () => {
  const withAnchor = `openapi: 3.1.0
info:
  title: &t Alias API
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const withAlias = `openapi: 3.1.0
info:
  title: Alias API
  version: *t
paths:
  /x:
    get:
      summary: ok`;
  assertRejectsUnsupported(withAnchor, "anchor");
  assertRejectsUnsupported(withAlias, "alias");
});

test("merge keys reject instead of partial OpenAPI", () => {
  const withMerge = `openapi: 3.1.0
info:
  title: Merge API
  version: "1.0"
paths:
  /x:
    get:
      <<:
        summary: Shared`;
  assertRejectsUnsupported(withMerge, "merge key");
});

test("duplicate mapping keys reject instead of last-wins OpenAPI", () => {
  const withDup = `openapi: 3.1.0
info:
  title: Dup API
  version: "1.0"
paths:
  /a:
    get:
      summary: first
  /a:
    get:
      summary: second`;
  assertRejectsUnsupported(withDup, "duplicate keys");
});

test("tab indentation rejects ambiguous structure", () => {
  const withTabIndent = "openapi: 3.1.0\ninfo:\n\ttitle: Tab API\n\tversion: \"1.0\"\npaths:\n  /x:\n    get:\n      summary: ok";
  assertRejectsUnsupported(withTabIndent, "tab indentation");
});

test("escaped or unterminated quoted scalars reject", () => {
  const unterminated = `openapi: 3.1.0
info:
  title: "unterminated
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const badEscape = `openapi: 3.1.0
info:
  title: "bad\\qescape"
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  assertRejectsUnsupported(unterminated, "unterminated quote");
  assertRejectsUnsupported(badEscape, "bad escape");
});

test("malformed trailing content after valid OpenAPI prefix rejects", () => {
  const trailing = `openapi: 3.1.0
info:
  title: Trailing API
  version: "1.0"
paths:
  /x:
    get:
      summary: ok
[[[[`;
  assertRejectsUnsupported(trailing, "trailing garbage");
});

test("unclosed flow sequence rejects instead of partial OpenAPI", () => {
  const unclosed = `openapi: 3.1.0
info:
  title: Flow API
  version: "1.0"
paths:
  /x:
    get:
      tags: [Pets
      summary: ok`;
  assertRejectsUnsupported(unclosed, "unclosed flow sequence");
});

test("mismatched flow delimiters reject instead of partial OpenAPI", () => {
  const mismatched = `openapi: 3.1.0
info:
  title: Flow API
  version: "1.0"
paths:
  /x:
    get:
      tags: [Pets}
      summary: ok`;
  assertRejectsUnsupported(mismatched, "mismatched flow delimiters");
});

test("anchored, aliased, or tagged block and flow keys reject", () => {
  const anchoredKey = `openapi: 3.1.0
info:
  &k title: Anchored
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const aliasedKey = `openapi: 3.1.0
info:
  *k: Aliased
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const taggedKey = `openapi: 3.1.0
info:
  !!str title: Tagged
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const flowAnchoredKey = `openapi: 3.1.0
info: {&k title: Anchored, version: "1.0"}
paths:
  /x:
    get:
      summary: ok`;
  const flowAliasedKey = `openapi: 3.1.0
info: {*k: Aliased, version: "1.0"}
paths:
  /x:
    get:
      summary: ok`;
  const flowTaggedKey = `openapi: 3.1.0
info: {!!str title: Tagged, version: "1.0"}
paths:
  /x:
    get:
      summary: ok`;
  assertRejectsUnsupported(anchoredKey, "anchored block key");
  assertRejectsUnsupported(aliasedKey, "aliased block key");
  assertRejectsUnsupported(taggedKey, "tagged block key");
  assertRejectsUnsupported(flowAnchoredKey, "anchored flow key");
  assertRejectsUnsupported(flowAliasedKey, "aliased flow key");
  assertRejectsUnsupported(flowTaggedKey, "tagged flow key");
});

test("explicit scalar tags reject instead of partial OpenAPI", () => {
  const taggedValue = `openapi: 3.1.0
info:
  title: !!str Tagged
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const flowTaggedValue = `openapi: 3.1.0
info: {title: !custom X, version: "1.0"}
paths:
  /x:
    get:
      summary: ok`;
  assertRejectsUnsupported(taggedValue, "tagged scalar value");
  assertRejectsUnsupported(flowTaggedValue, "tagged flow scalar value");
});

test("__proto__ mapping payload does not inherit OpenAPI shape", () => {
  const poisoned = `__proto__:
  openapi: 3.1.0
  paths:
    /x:
      get:
        summary: ok
  info:
    title: Proto
    version: "1.0"`;
  const parsed = parseYaml(poisoned) as object | null;
  if (parsed !== null) {
    assert.equal(Object.getPrototypeOf(parsed), null, "__proto__: mappings must use a null prototype");
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, "openapi"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, "paths"), false);
  }
  const result = extractScene(poisoned, "engineer");
  assert.equal(result.document.source.kind, "text", "__proto__: must fall back to plain-text extraction");
  assert.notEqual(result.document.source.kind, "openapi", "__proto__: must not masquerade as OpenAPI");
});

test("repeated YAML document markers reject", () => {
  const repeated = `---
---
openapi: 3.1.0
info:
  title: Multi
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const secondDoc = `---
openapi: 3.1.0
info:
  title: First
  version: "1.0"
paths:
  /x:
    get:
      summary: ok
---
openapi: 3.1.0
info:
  title: Second
  version: "1.0"
paths:
  /y:
    get:
      summary: other`;
  assertRejectsUnsupported(repeated, "repeated document start markers");
  assertRejectsUnsupported(secondDoc, "second YAML document");
});

test("double-quoted hexadecimal escape decodes in titles", () => {
  const source = `openapi: 3.1.0
info:
  title: "Pet\\x20API"
  version: "1.0"
paths:
  /x:
    get:
      summary: ok`;
  const doc = parseYaml(source) as any;
  assert.equal(doc.info.title, "Pet API");
  const result = extractScene(source, "customer");
  assert.equal(result.document.source.kind, "openapi");
  assert.equal(result.document.title, "Pet API");
});

test("literal block scalar preserves indented hash-prefixed content", () => {
  const source = `openapi: 3.1.0
info:
  title: Hash API
  version: "1.0"
paths:
  /x:
    get:
      description: |
        # keep this line
        still here`;
  const doc = parseYaml(source) as any;
  assert.equal(doc.paths["/x"].get.description, "# keep this line\nstill here");
});

test("balanced flow nested beyond MAX_DEPTH rejects and falls back to text", () => {
  // Flow depth is independent of block depth: nest past the parser's MAX_DEPTH (100)
  // with a balanced collection inside otherwise valid OpenAPI YAML.
  const nest = 101;
  const deepFlow = `${"[".repeat(nest)}Pets${"]".repeat(nest)}`;
  const source = `openapi: 3.1.0
info:
  title: Deep Flow API
  version: "1.0"
paths:
  /x:
    get:
      tags: ${deepFlow}
      summary: ok`;
  assertRejectsUnsupported(source, "flow nesting beyond MAX_DEPTH");
});
