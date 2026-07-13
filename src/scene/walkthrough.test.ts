import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { stepSpotlight, walkthroughSteps } from "./walkthrough.ts";
import { walkthroughHtml } from "./exportText.ts";

test("walkthrough is an overview followed by one step per edge, in source order", () => {
  const doc = extractScene("A -> B: first\nB -> C: second", "engineer").document;
  const steps = walkthroughSteps(doc);
  assert.equal(steps.length, doc.edges.length + 1);
  assert.equal(steps[0].edgeId, null);
  assert.equal(steps[1].caption, "A -> B: first");
  assert.deepEqual(steps[1].blockIds, [doc.edges[0].from, doc.edges[0].to]);
  assert.equal(steps[2].edgeId, doc.edges[1].id);
});

test("overview step carries no spotlight; edge steps do", () => {
  const doc = extractScene("A -> B: calls", "engineer").document;
  const steps = walkthroughSteps(doc);
  assert.equal(stepSpotlight(steps[0]), null);
  assert.deepEqual(stepSpotlight(steps[1]), { blockIds: steps[1].blockIds, edgeId: steps[1].edgeId });
});

test("walkthrough HTML embeds steps, controls, and escapes markup", () => {
  const html = walkthroughHtml("<svg></svg>", [{ index: 0, caption: "</script><b>x</b>", blockIds: [], edgeId: null }]);
  assert.match(html, /walk-steps/);
  assert.match(html, /walk-play/);
  assert.doesNotMatch(html, /<\/script><b>/);
});
