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

function mutate(patch: (value: ReturnType<typeof fixture>) => void) {
  const value = fixture();
  patch(value);
  return value;
}

test("rejects non-object documents", () => {
  for (const value of [null, undefined, "scene", 1]) {
    assert.deepEqual(validateSceneDocument(value), { ok: false, error: "document must be an object" });
  }
});

test("rejects unsupported schemaVersion", () => {
  assert.deepEqual(validateSceneDocument(mutate((v) => { v.schemaVersion = 2; })), { ok: false, error: "schemaVersion must be 1" });
});

test("rejects non-string document strings", () => {
  for (const key of ["title", "subtitle", "summary"] as const) {
    assert.deepEqual(
      validateSceneDocument(mutate((v) => { v[key] = 42; })),
      { ok: false, error: `${key} must be a string` },
    );
  }
});

test("accepts supported audience and view enums", () => {
  for (const audience of ["engineer", "exec", "student", "customer"] as const) {
    assert.equal(validateSceneDocument(mutate((v) => { v.audience = audience; })).ok, true);
  }
  for (const view of ["architecture", "sequence"] as const) {
    assert.equal(validateSceneDocument(mutate((v) => { v.view = view; })).ok, true);
  }
});

test("rejects unsupported audience and view enums", () => {
  assert.deepEqual(validateSceneDocument(mutate((v) => { v.audience = "investor"; })), { ok: false, error: "audience is unsupported" });
  assert.deepEqual(validateSceneDocument(mutate((v) => { v.view = "flowchart"; })), { ok: false, error: "view is unsupported" });
});

test("rejects invalid source payloads", () => {
  const cases: Array<{ label: string; patch: (v: ReturnType<typeof fixture>) => void }> = [
    { label: "missing source", patch: (v) => { v.source = undefined; } },
    { label: "unsupported kind", patch: (v) => { v.source.kind = "yaml"; } },
    { label: "missing text", patch: (v) => { delete v.source.text; } },
    { label: "non-string text", patch: (v) => { v.source.text = 42; } },
  ];
  for (const { label, patch } of cases) {
    assert.deepEqual(
      validateSceneDocument(mutate(patch)),
      { ok: false, error: "source must contain kind and text" },
      label,
    );
  }
});

test("accepts supported source kinds", () => {
  for (const kind of ["text", "openapi"] as const) {
    assert.equal(validateSceneDocument(mutate((v) => { v.source.kind = kind; })).ok, true);
  }
});

test("source.text size limit boundaries", () => {
  assert.equal(validateSceneDocument(mutate((v) => {
    v.source.text = "x".repeat(SCENE_LIMITS.source);
    v.facts = [];
    v.edges = [];
    v.blocks = [];
  })).ok, true);
  assert.deepEqual(
    validateSceneDocument(mutate((v) => { v.source.text = "x".repeat(SCENE_LIMITS.source + 1); })),
    { ok: false, error: "source.text exceeds the size limit" },
  );
});

test("rejects non-array collections", () => {
  for (const key of ["facts", "terms", "blocks", "edges", "warnings"] as const) {
    assert.deepEqual(
      validateSceneDocument(mutate((v) => { v[key] = {}; })),
      { ok: false, error: `${key} must be an array` },
    );
  }
});

test("collection size limit boundaries", () => {
  const sentinelFacts = Array.from({ length: SCENE_LIMITS.facts }, (_, i) => ({
    id: `fact-${i}`,
    text: `fact ${i}`,
    start: -1,
    end: -1,
  }));
  const maxBlocks = Array.from({ length: SCENE_LIMITS.blocks }, (_, i) => ({
    id: `block-${i}`,
    label: `Block ${i}`,
    kind: "service",
    detail: "",
    factIds: [] as string[],
    x: 0,
    y: 0,
    w: 10,
    h: 10,
  }));
  const maxEdges = Array.from({ length: SCENE_LIMITS.edges }, (_, i) => ({
    id: `edge-${i}`,
    from: "block-0",
    to: "block-1",
    label: "calls",
    factIds: [] as string[],
  }));

  const acceptCases = [
    { key: "facts" as const, value: sentinelFacts, clearEdges: true, clearFactRefs: true },
    { key: "terms" as const, value: Array.from({ length: SCENE_LIMITS.terms }, (_, i) => `term-${i}`) },
    { key: "blocks" as const, value: maxBlocks, clearEdges: true },
    { key: "edges" as const, value: maxEdges, facts: sentinelFacts, blocks: maxBlocks },
    { key: "warnings" as const, value: Array.from({ length: SCENE_LIMITS.warnings }, (_, i) => `warning ${i}`) },
  ];

  const applyCase = (v: ReturnType<typeof fixture>, entry: (typeof acceptCases)[number], overflow = false) => {
    if (entry.facts) v.facts = entry.facts;
    if (entry.blocks) v.blocks = entry.blocks;
    if (entry.clearFactRefs) {
      for (const block of v.blocks) block.factIds = [];
    }
    v[entry.key] = overflow
      ? [...entry.value, entry.key === "terms" || entry.key === "warnings" ? "overflow" : entry.value[0]]
      : entry.value;
    if (entry.clearEdges) v.edges = [];
  };

  for (const entry of acceptCases) {
    assert.equal(
      validateSceneDocument(mutate((v) => { applyCase(v, entry); })).ok,
      true,
      `${entry.key} at exact cap should pass`,
    );
    assert.deepEqual(
      validateSceneDocument(mutate((v) => { applyCase(v, entry, true); })),
      { ok: false, error: `${entry.key} exceeds the size limit` },
      `${entry.key} above cap should fail`,
    );
  }
});

test("rejects invalid facts", () => {
  const cases: Array<{ label: string; patch: (v: ReturnType<typeof fixture>) => void; error: string }> = [
    { label: "non-object fact", patch: (v) => { v.facts[0] = null; }, error: "facts[0] is invalid" },
    { label: "non-string id", patch: (v) => { v.facts[0].id = 1; }, error: "facts[0] is invalid" },
    { label: "non-string text", patch: (v) => { v.facts[0].text = 1; }, error: "facts[0] is invalid" },
    { label: "non-integer end", patch: (v) => { v.facts[0].end = 0.5; }, error: "facts[0] is invalid" },
    { label: "missing id", patch: (v) => { v.facts[0] = { text: "x", start: 0, end: 1 }; }, error: "facts[0] is invalid" },
    { label: "duplicate id", patch: (v) => { v.facts.push({ ...v.facts[0] }); }, error: "facts[1].id must be unique" },
    { label: "end before start", patch: (v) => { v.facts[0].start = 5; v.facts[0].end = 4; }, error: "facts[0] is invalid" },
    { label: "negative start without sentinel", patch: (v) => { v.facts[0].start = -2; v.facts[0].end = 0; }, error: "facts[0] is invalid" },
    { label: "non-integer start", patch: (v) => { v.facts[0].start = 0.5; }, error: "facts[0] is invalid" },
  ];
  for (const { label, patch, error } of cases) {
    assert.deepEqual(validateSceneDocument(mutate(patch)), { ok: false, error }, label);
  }
});

test("accepts supported block kinds", () => {
  for (const kind of ["actor", "service", "store", "interface", "step", "source"] as const) {
    assert.equal(validateSceneDocument(mutate((v) => { v.blocks[0].kind = kind; })).ok, true);
  }
});

test("rejects invalid blocks", () => {
  const cases: Array<{ label: string; patch: (v: ReturnType<typeof fixture>) => void; error: string }> = [
    { label: "non-object block", patch: (v) => { v.blocks[0] = null; }, error: "blocks[0] is invalid" },
    { label: "non-string id", patch: (v) => { v.blocks[0].id = 1; }, error: "blocks[0] is invalid" },
    { label: "non-string label", patch: (v) => { v.blocks[0].label = 1; }, error: "blocks[0] is invalid" },
    { label: "non-string detail", patch: (v) => { v.blocks[0].detail = 1; }, error: "blocks[0] is invalid" },
    { label: "unsupported kind", patch: (v) => { v.blocks[0].kind = "database"; }, error: "blocks[0] is invalid" },
    { label: "unknown fact reference", patch: (v) => { v.blocks[0].factIds = ["missing-fact"]; }, error: "blocks[0].factIds references an unknown fact" },
    { label: "non-array factIds", patch: (v) => { v.blocks[0].factIds = "fact"; }, error: "blocks[0] is invalid" },
  ];
  for (const { label, patch, error } of cases) {
    assert.deepEqual(validateSceneDocument(mutate(patch)), { ok: false, error }, label);
  }
});

test("rejects invalid block geometry", () => {
  const cases: Array<{ field: "x" | "y" | "w" | "h"; value: number; error: string }> = [
    { field: "x", value: Number.NaN, error: "blocks[0].x is invalid" },
    { field: "y", value: Number.POSITIVE_INFINITY, error: "blocks[0].y is invalid" },
    { field: "w", value: 0, error: "blocks[0].w is invalid" },
    { field: "h", value: -1, error: "blocks[0].h is invalid" },
  ];
  for (const { field, value, error } of cases) {
    assert.deepEqual(
      validateSceneDocument(mutate((v) => { v.blocks[0][field] = value; })),
      { ok: false, error },
    );
  }
});

test("rejects invalid edges", () => {
  const cases: Array<{ label: string; patch: (v: ReturnType<typeof fixture>) => void; error: string }> = [
    { label: "non-object edge", patch: (v) => { v.edges[0] = null; }, error: "edges[0] is invalid" },
    { label: "non-string id", patch: (v) => { v.edges[0].id = 1; }, error: "edges[0] is invalid" },
    { label: "non-string from", patch: (v) => { v.edges[0].from = 1; }, error: "edges[0] is invalid" },
    { label: "non-string to", patch: (v) => { v.edges[0].to = 1; }, error: "edges[0] is invalid" },
    { label: "non-string label", patch: (v) => { v.edges[0].label = 1; }, error: "edges[0] is invalid" },
    { label: "unknown from block", patch: (v) => { v.edges[0].from = "missing"; }, error: "edges[0].from references an unknown block" },
    { label: "duplicate id", patch: (v) => { v.edges.push({ ...v.edges[0], id: "a-b" }); }, error: "edges[1].id must be unique" },
    { label: "unknown fact reference", patch: (v) => { v.edges[0].factIds = ["missing-fact"]; }, error: "edges[0].factIds references an unknown fact" },
    { label: "non-array factIds", patch: (v) => { v.edges[0].factIds = "fact"; }, error: "edges[0] is invalid" },
  ];
  for (const { label, patch, error } of cases) {
    assert.deepEqual(validateSceneDocument(mutate(patch)), { ok: false, error }, label);
  }
});


test("accepts optional edge and block confidence and competingHypothesis", () => {
  const value = fixture();
  value.edges[0].confidence = "high";
  value.edges[0].competingHypothesis = true;
  value.blocks[0].confidence = "medium";
  value.blocks[1].competingHypothesis = false;
  const result = validateSceneDocument(value);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.edges[0].confidence, "high");
  assert.equal(result.value.edges[0].competingHypothesis, true);
  assert.equal(result.value.blocks[0].confidence, "medium");
  assert.equal(result.value.blocks[1].competingHypothesis, false);
});

test("accepts all supported confidence levels", () => {
  for (const confidence of ["high", "medium", "low"] as const) {
    assert.equal(
      validateSceneDocument(mutate((v) => { v.edges[0].confidence = confidence; })).ok,
      true,
      `edge confidence ${confidence}`,
    );
    assert.equal(
      validateSceneDocument(mutate((v) => { v.blocks[0].confidence = confidence; })).ok,
      true,
      `block confidence ${confidence}`,
    );
  }
});

test("rejects unsupported confidence values", () => {
  assert.deepEqual(
    validateSceneDocument(mutate((v) => { v.edges[0].confidence = "certain"; })),
    { ok: false, error: "edges[0].confidence is unsupported" },
  );
  assert.deepEqual(
    validateSceneDocument(mutate((v) => { v.blocks[0].confidence = "certain"; })),
    { ok: false, error: "blocks[0].confidence is unsupported" },
  );
});

test("rejects non-boolean competingHypothesis", () => {
  assert.deepEqual(
    validateSceneDocument(mutate((v) => { v.edges[0].competingHypothesis = "yes"; })),
    { ok: false, error: "edges[0].competingHypothesis must be a boolean" },
  );
  assert.deepEqual(
    validateSceneDocument(mutate((v) => { v.blocks[0].competingHypothesis = 1; })),
    { ok: false, error: "blocks[0].competingHypothesis must be a boolean" },
  );
});

test("JSON round-trip preserves confidence and competingHypothesis", () => {
  const value = fixture();
  value.edges[0].confidence = "low";
  value.edges[0].competingHypothesis = true;
  value.blocks[0].confidence = "high";
  value.blocks[0].competingHypothesis = true;
  const parsed = JSON.parse(JSON.stringify(value));
  const result = validateSceneDocument(parsed);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.edges[0].confidence, "low");
  assert.deepEqual(result.value.edges[0].competingHypothesis, true);
  assert.deepEqual(result.value.blocks[0].confidence, "high");
  assert.deepEqual(result.value.blocks[0].competingHypothesis, true);
});
