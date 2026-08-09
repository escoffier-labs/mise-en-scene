// Deterministic walkthrough frame plan for 30 fps video export.
// Pure: no DOM, timers, MediaRecorder, or canvas. The browser recorder in
// App.tsx draws each planned frame in order.

import type { SceneDocument } from "./types.ts";
import { stepViewport, walkthroughSteps, type Viewport } from "./walkthrough.ts";

export const WALK_FPS = 30;
export const OPENING_FRAMES = 60;
export const PAN_FRAMES = 20;
export const HOLD_FRAMES = 36;

export type WalkFrame = {
  index: number;
  timestampMs: number;
  durationMs: number;
  stepIndex: number;
  viewport: Viewport;
};

export type WalkthroughPlan = {
  fps: number;
  frames: WalkFrame[];
  durationMs: number;
};

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerpViewport(a: Viewport, b: Viewport, e: number): Viewport {
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    w: a.w + (b.w - a.w) * e,
    h: a.h + (b.h - a.h) * e,
  };
}

function pushHold(
  out: Omit<WalkFrame, "index" | "timestampMs" | "durationMs">[],
  stepIndex: number,
  viewport: Viewport,
  count: number,
) {
  for (let i = 0; i < count; i++) out.push({ stepIndex, viewport });
}

function pushPan(
  out: Omit<WalkFrame, "index" | "timestampMs" | "durationMs">[],
  stepIndex: number,
  from: Viewport,
  to: Viewport,
  count: number,
) {
  for (let f = 1; f <= count; f++) {
    out.push({ stepIndex, viewport: lerpViewport(from, to, easeInOutCubic(f / count)) });
  }
}

// Exact logical frames for a walkthrough at WALK_FPS. For E edges the plan has
// 116 + 56E frames: 60 opening, then 20 pan + 36 hold per edge, then 20
// pullback + 36 closing hold.
export function planWalkthroughFrames(scene: SceneDocument, fps = WALK_FPS): WalkthroughPlan {
  const steps = walkthroughSteps(scene);
  const views = steps.map((step) => stepViewport(scene, step));
  const raw: Omit<WalkFrame, "index" | "timestampMs" | "durationMs">[] = [];

  pushHold(raw, 0, views[0], OPENING_FRAMES);

  let prev = views[0];
  for (let k = 1; k < steps.length; k++) {
    pushPan(raw, k, prev, views[k], PAN_FRAMES);
    pushHold(raw, k, views[k], HOLD_FRAMES);
    prev = views[k];
  }

  pushPan(raw, 0, prev, views[0], PAN_FRAMES);
  pushHold(raw, 0, views[0], HOLD_FRAMES);

  const durationMs = 1000 / fps;
  const frames: WalkFrame[] = raw.map((frame, index) => ({
    ...frame,
    index,
    timestampMs: index * durationMs,
    durationMs,
  }));

  return { fps, frames, durationMs: frames.length * durationMs };
}
