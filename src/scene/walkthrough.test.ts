import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { CANVAS, stepCamera, stepSpotlight, stepViewport, viewportTransform, walkthroughSteps } from "./walkthrough.ts";
import { layoutScene } from "./layout.ts";
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

test("camera frames the whole canvas on overview and zooms on edge steps", () => {
  const doc = layoutScene(extractScene("A -> B: calls\nB -> C: reads", "engineer").document, "architecture");
  const steps = walkthroughSteps(doc);
  assert.deepEqual(stepViewport(doc, steps[0]), { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h });
  assert.equal(viewportTransform(stepViewport(doc, steps[0])), "translate(0 0) scale(1)");
  const zoomed = stepViewport(doc, steps[1]);
  assert.ok(zoomed.w < CANVAS.w && zoomed.h < CANVAS.h, "edge step zooms in");
  assert.ok(zoomed.x >= 0 && zoomed.y >= 0 && zoomed.x + zoomed.w <= CANVAS.w && zoomed.y + zoomed.h <= CANVAS.h, "viewport stays in bounds");
  assert.equal(stepCamera(doc, steps[1]), viewportTransform(zoomed));
});

test("walkthrough HTML embeds steps, controls, and escapes markup", () => {
  const html = walkthroughHtml("<svg></svg>", [{ index: 0, caption: "</script><b>x</b>", blockIds: [], edgeId: null }]);
  assert.match(html, /walk-steps/);
  assert.match(html, /walk-play/);
  assert.doesNotMatch(html, /<\/script><b>/);
});
