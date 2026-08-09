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

test("repeated arrow lines with identical evidence keep distinct source offsets", () => {
  const source = "A -> B: same line\nA -> B: same line";
  const result = extractScene(source, "engineer");
  const edgeFacts = result.document.edges.map((edge) => result.document.facts.find((fact) => fact.id === edge.factIds[0])!);
  assert.equal(edgeFacts.length, 2);
  assert.equal(edgeFacts[0].text, edgeFacts[1].text);
  assert.notEqual(edgeFacts[0].start, edgeFacts[1].start);
  assert.equal(source.slice(edgeFacts[0].start, edgeFacts[0].end), "A -> B: same line");
  assert.equal(source.slice(edgeFacts[1].start, edgeFacts[1].end), "A -> B: same line");
});

test("OpenAPI JSON facts map escaped summaries to decoded text in the source", () => {
  const summary = "Say \"hi\"\nand bye";
  const source = JSON.stringify({
    openapi: "3.1.0",
    info: { title: "API" },
    paths: { "/pets": { get: { tags: ["Pets"], summary } } },
  });
  const result = extractScene(source, "engineer");
  const fact = result.document.facts.find((item) => item.text === summary)!;
  const escaped = JSON.stringify(summary).slice(1, -1);
  assert.equal(fact.text, summary);
  assert.equal(source.indexOf(escaped), fact.start);
  assert.equal(source.slice(fact.start, fact.end), escaped);
});

const fourSectionIncident = `# Checkout outage incident

## Timeline
- 10:00 alerts fired
- 10:15 bad deploy identified

## Indicators
- Elevated 5xx rate on checkout
- Cache miss spike in edge

## Impact
Checkout unavailable for forty minutes across US-EAST.

## Handoff
- Rollback completed by platform
- Owner remains on-call overnight
`;

test("four-section incident report yields canonical blocks, informs edges, and exact offsets", () => {
  const result = extractScene(fourSectionIncident, "engineer");
  assert.equal(result.fallback, false);
  assert.equal(result.document.warnings.length, 0);
  assert.equal(result.document.title, "Checkout outage incident");
  assert.match(result.document.summary, /incident/i);
  assert.deepEqual(result.document.blocks.map((b) => b.label), ["Timeline", "Indicators", "Impact", "Handoff"]);
  assert.deepEqual(result.document.blocks.map((b) => b.kind), ["step", "source", "step", "step"]);
  assert.equal(result.document.edges.length, 3);
  assert.deepEqual(result.document.edges.map((e) => e.label), ["informs", "informs", "informs"]);
  assert.deepEqual(
    result.document.edges.map((e) => [e.from, e.to]),
    [
      [result.document.blocks[0].id, result.document.blocks[1].id],
      [result.document.blocks[1].id, result.document.blocks[2].id],
      [result.document.blocks[2].id, result.document.blocks[3].id],
    ],
  );
  for (const fact of result.document.facts) {
    assert.equal(fourSectionIncident.slice(fact.start, fact.end), fact.text);
  }
  const impact = result.document.blocks.find((b) => b.label === "Impact")!;
  const impactFact = result.document.facts.find((f) => impact.factIds.includes(f.id))!;
  assert.equal(impactFact.text, "Checkout unavailable for forty minutes across US-EAST.");
  const edgeToImpact = result.document.edges[1];
  assert.equal(edgeToImpact.factIds[0], impact.factIds[0]);
  assert.equal(validateSceneDocument(result.document).ok, true);
});

test("incident aliases and numbered timeline entries are recognized", () => {
  const source = `# Breach postmortem

## Chronology
1. Detected anomalous login
2. Contained the account

## Indicators of Compromise
- Suspicious IP observed

## Scope
Customer portal login affected overnight.

## Next steps
- Rotate credentials
- Notify account owners
`;
  const result = extractScene(source, "student");
  assert.equal(result.fallback, false);
  assert.deepEqual(result.document.blocks.map((b) => b.label), ["Timeline", "Indicators", "Impact", "Handoff"]);
  const timeline = result.document.blocks.find((b) => b.label === "Timeline")!;
  const texts = timeline.factIds.map((id) => result.document.facts.find((f) => f.id === id)!.text);
  assert.ok(texts.includes("Detected anomalous login"));
  assert.ok(texts.includes("Contained the account"));
  for (const fact of result.document.facts) {
    assert.equal(source.slice(fact.start, fact.end), fact.text);
  }
  assert.equal(validateSceneDocument(result.document).ok, true);
});

test("two recognized incident sections produce only those blocks and one edge", () => {
  const source = `# Service compromise report

## Timeline
- First alert at 09:12

## Handoff
- Transfer ownership to security
`;
  const result = extractScene(source, "exec");
  assert.equal(result.fallback, false);
  assert.deepEqual(result.document.blocks.map((b) => b.label), ["Timeline", "Handoff"]);
  assert.equal(result.document.edges.length, 1);
  assert.equal(result.document.edges[0].label, "informs");
  assert.equal(result.document.edges[0].from, result.document.blocks[0].id);
  assert.equal(result.document.edges[0].to, result.document.blocks[1].id);
  assert.equal(result.document.edges[0].factIds[0], result.document.blocks[1].factIds[0]);
  assert.equal(validateSceneDocument(result.document).ok, true);
});

test("generic Impact heading without an incident signal stays on the existing path", () => {
  const source = `# Product roadmap

## Impact
- Faster onboarding

## Next steps
- Ship the funnel
`;
  const result = extractScene(source, "engineer");
  // Existing generic path: Markdown headings become blocks; without arrows this is fallback.
  assert.equal(result.fallback, true);
  assert.match(result.document.warnings[0], /fallback/i);
  assert.deepEqual(result.document.blocks.map((b) => b.label), ["Source", "Process", "Artifact"]);
  assert.equal(result.document.edges.some((e) => e.label === "informs"), false);
});

test("incident extraction respects scene fact caps", () => {
  const bullets = Array.from({ length: SCENE_LIMITS.facts + 4 }, (_, i) => `- Signal ${i}`).join("\n");
  const source = `# Network outage incident\n\n## Timeline\n${bullets}\n\n## Impact\n- Users blocked\n`;
  const result = extractScene(source, "engineer");
  assert.equal(result.fallback, false);
  assert.ok(result.document.facts.length <= SCENE_LIMITS.facts);
  assert.ok(result.document.blocks.length <= SCENE_LIMITS.blocks);
  assert.ok(result.document.edges.length <= SCENE_LIMITS.edges);
  assert.equal(validateSceneDocument(result.document).ok, true);
});
