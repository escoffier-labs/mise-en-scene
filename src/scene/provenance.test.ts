import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { provenanceNarrative } from "./provenance.ts";
import type { SceneDocument } from "./types.ts";

function bareScene(patch: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    title: "Demo scene",
    subtitle: "test",
    summary: "summary",
    audience: "engineer",
    view: "architecture",
    source: { kind: "text", text: "" },
    facts: [],
    terms: [],
    blocks: [],
    edges: [],
    warnings: [],
    ...patch,
  };
}

test("provenance narrative covers every block and edge with evidence text and offsets", () => {
  const document = extractScene("Browser -> API: sends request\nAPI -> Database: reads rows", "engineer").document;
  const text = provenanceNarrative(document);

  assert.match(text, /Provenance/);
  assert.match(text, new RegExp(document.title));

  for (const block of document.blocks) {
    assert.match(text, new RegExp(`Block: ${block.label}`));
  }
  for (const edge of document.edges) {
    assert.match(text, new RegExp(`Edge: ${edge.id}|${edge.label}`));
  }

  const linkedIds = new Set([
    ...document.blocks.flatMap((block) => block.factIds),
    ...document.edges.flatMap((edge) => edge.factIds),
  ]);
  for (const fact of document.facts.filter((f) => linkedIds.has(f.id))) {
    assert.match(text, new RegExp(fact.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, new RegExp(`\\[${fact.start}:${fact.end}\\]`));
  }
});

test("provenance narrative reports blocks and edges with no attached facts", () => {
  const document = bareScene({
    blocks: [
      { id: "lonely", label: "Lonely", kind: "service", detail: "no facts", factIds: [], x: 0, y: 0, w: 100, h: 40 },
    ],
    edges: [
      { id: "lonely-edge", from: "lonely", to: "lonely", label: "self", factIds: [] },
    ],
  });
  const text = provenanceNarrative(document);

  assert.match(text, /Block: Lonely/);
  assert.match(text, /Edge: Lonely -> Lonely: self|lonely-edge/);
  assert.match(text, /No direct source evidence attached/);
  const evidenceSections = text.split("No direct source evidence attached");
  assert.ok(evidenceSections.length >= 3, "both block and edge should note missing evidence");
});

test("provenance narrative lists only facts linked to each element", () => {
  const document = bareScene({
    facts: [
      { id: "f-a", text: "fact for alpha", start: 0, end: 14 },
      { id: "f-b", text: "fact for beta", start: 20, end: 33 },
    ],
    blocks: [
      { id: "alpha", label: "Alpha", kind: "service", detail: "a", factIds: ["f-a"], x: 0, y: 0, w: 100, h: 40 },
      { id: "beta", label: "Beta", kind: "store", detail: "b", factIds: ["f-b"], x: 0, y: 0, w: 100, h: 40 },
    ],
    edges: [
      { id: "alpha-beta", from: "alpha", to: "beta", label: "writes", factIds: ["f-a"] },
    ],
  });
  const text = provenanceNarrative(document);
  const alphaSection = text.slice(text.indexOf("Block: Alpha"), text.indexOf("Block: Beta"));
  const betaSection = text.slice(text.indexOf("Block: Beta"), text.indexOf("Relationships") >= 0 ? text.indexOf("Relationships") : text.indexOf("Edge:"));
  const edgeSection = text.slice(text.indexOf("Edge:"));

  assert.match(alphaSection, /fact for alpha/);
  assert.match(alphaSection, /\[0:14\]/);
  assert.doesNotMatch(alphaSection, /fact for beta/);
  assert.match(betaSection, /fact for beta/);
  assert.match(betaSection, /\[20:33\]/);
  assert.doesNotMatch(betaSection, /fact for alpha/);
  assert.match(edgeSection, /fact for alpha/);
  assert.doesNotMatch(edgeSection, /fact for beta/);
});
