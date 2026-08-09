import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import { layoutScene } from "./layout.ts";
import { stepViewport, walkthroughSteps } from "./walkthrough.ts";
import {
  HOLD_FRAMES,
  OPENING_FRAMES,
  PAN_FRAMES,
  WALK_FPS,
  easeInOutCubic,
  lerpViewport,
  planWalkthroughFrames,
  type WalkFrame,
} from "./walkthroughPlan.ts";

function sceneWithEdges(edgeCount: number) {
  if (edgeCount === 0) {
    // extractScene synthesizes a default flow for edge-free text, so build an
    // overview-only document directly for the zero-edge case.
    const base = layoutScene(extractScene("A -> B: keep layout", "engineer").document, "architecture");
    return { ...base, edges: [], title: "Overview only" };
  }
  const lines = Array.from({ length: edgeCount }, (_, i) => {
    const from = String.fromCharCode(65 + i);
    const to = String.fromCharCode(66 + i);
    return `${from} -> ${to}: step ${i + 1}`;
  });
  return layoutScene(extractScene(lines.join("\n"), "engineer").document, "architecture");
}

function expectedFrameCount(edgeCount: number): number {
  return 116 + 56 * edgeCount;
}

function assertMonotonicTimestamps(frames: WalkFrame[], fps: number) {
  const frameMs = 1000 / fps;
  for (let i = 0; i < frames.length; i++) {
    assert.equal(frames[i].index, i);
    assert.equal(frames[i].durationMs, frameMs);
    assert.equal(frames[i].timestampMs, i * frameMs);
    if (i > 0) assert.ok(frames[i].timestampMs > frames[i - 1].timestampMs);
  }
}

test("plan has 116 frames and matching duration for a zero-edge scene", () => {
  const scene = sceneWithEdges(0);
  const plan = planWalkthroughFrames(scene);
  assert.equal(scene.edges.length, 0);
  assert.equal(plan.fps, WALK_FPS);
  assert.equal(plan.frames.length, expectedFrameCount(0));
  assert.equal(plan.frames.length, OPENING_FRAMES + PAN_FRAMES + HOLD_FRAMES);
  assert.equal(plan.durationMs, plan.frames.length * (1000 / WALK_FPS));
  assertMonotonicTimestamps(plan.frames, plan.fps);
  assert.ok(plan.frames.every((frame) => frame.stepIndex === 0));
});

test("plan has 172 frames for one edge: opening, pan, hold, pullback, close", () => {
  const scene = sceneWithEdges(1);
  const plan = planWalkthroughFrames(scene);
  const steps = walkthroughSteps(scene);
  const views = steps.map((step) => stepViewport(scene, step));
  assert.equal(scene.edges.length, 1);
  assert.equal(plan.frames.length, expectedFrameCount(1));
  assert.equal(plan.frames.length, 172);
  assert.equal(plan.durationMs, 172 * (1000 / WALK_FPS));
  assertMonotonicTimestamps(plan.frames, plan.fps);

  const opening = plan.frames.slice(0, OPENING_FRAMES);
  assert.ok(opening.every((frame) => frame.stepIndex === 0));
  assert.deepEqual(opening[0].viewport, views[0]);

  const pan = plan.frames.slice(OPENING_FRAMES, OPENING_FRAMES + PAN_FRAMES);
  assert.equal(pan.length, PAN_FRAMES);
  assert.ok(pan.every((frame) => frame.stepIndex === 1));
  assert.deepEqual(pan[PAN_FRAMES - 1].viewport, views[1]);
  const mid = pan[Math.floor(PAN_FRAMES / 2) - 1];
  const expectedMid = lerpViewport(views[0], views[1], easeInOutCubic(10 / PAN_FRAMES));
  assert.deepEqual(mid.viewport, expectedMid);

  const hold = plan.frames.slice(OPENING_FRAMES + PAN_FRAMES, OPENING_FRAMES + PAN_FRAMES + HOLD_FRAMES);
  assert.ok(hold.every((frame) => frame.stepIndex === 1 && deepEqualViewport(frame.viewport, views[1])));

  const pullbackStart = OPENING_FRAMES + PAN_FRAMES + HOLD_FRAMES;
  const pullback = plan.frames.slice(pullbackStart, pullbackStart + PAN_FRAMES);
  assert.ok(pullback.every((frame) => frame.stepIndex === 0));
  assert.deepEqual(pullback[PAN_FRAMES - 1].viewport, views[0]);

  const closing = plan.frames.slice(pullbackStart + PAN_FRAMES);
  assert.equal(closing.length, HOLD_FRAMES);
  assert.ok(closing.every((frame) => frame.stepIndex === 0 && deepEqualViewport(frame.viewport, views[0])));
});

test("plan follows 116 + 56E for multiple edges and ends on overview", () => {
  const scene = sceneWithEdges(3);
  const plan = planWalkthroughFrames(scene);
  const steps = walkthroughSteps(scene);
  const views = steps.map((step) => stepViewport(scene, step));
  assert.equal(scene.edges.length, 3);
  assert.equal(plan.frames.length, expectedFrameCount(3));
  assert.equal(plan.durationMs, plan.frames.length * (1000 / WALK_FPS));
  assertMonotonicTimestamps(plan.frames, plan.fps);

  let offset = OPENING_FRAMES;
  for (let edge = 1; edge <= 3; edge++) {
    const pan = plan.frames.slice(offset, offset + PAN_FRAMES);
    const hold = plan.frames.slice(offset + PAN_FRAMES, offset + PAN_FRAMES + HOLD_FRAMES);
    assert.ok(pan.every((frame) => frame.stepIndex === edge));
    assert.deepEqual(pan[PAN_FRAMES - 1].viewport, views[edge]);
    assert.ok(hold.every((frame) => frame.stepIndex === edge && deepEqualViewport(frame.viewport, views[edge])));
    offset += PAN_FRAMES + HOLD_FRAMES;
  }

  const pullback = plan.frames.slice(offset, offset + PAN_FRAMES);
  const closing = plan.frames.slice(offset + PAN_FRAMES);
  assert.ok(pullback.every((frame) => frame.stepIndex === 0));
  assert.deepEqual(pullback[PAN_FRAMES - 1].viewport, views[0]);
  assert.equal(closing.length, HOLD_FRAMES);
  assert.ok(closing.every((frame) => frame.stepIndex === 0 && deepEqualViewport(frame.viewport, views[0])));
});

function deepEqualViewport(a: WalkFrame["viewport"], b: WalkFrame["viewport"]): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
