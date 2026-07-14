// The walkthrough tour model: an ordered sequence of steps that spotlight one
// relationship at a time. Both the offline animated-HTML player and the WebM
// video recorder consume this single model so the two exports cannot drift.
//
// Step 0 is an overview (no spotlight, whole scene visible). Each following
// step highlights one edge and its two endpoint blocks, in source order.

import type { SceneDocument } from "./types.ts";

export type Spotlight = { blockIds: string[]; edgeId: string | null };
export type WalkStep = { index: number; caption: string; blockIds: string[]; edgeId: string | null };

export function walkthroughSteps(scene: SceneDocument): WalkStep[] {
  const labels = new Map(scene.blocks.map((block) => [block.id, block.label]));
  const steps: WalkStep[] = [{ index: 0, caption: scene.title || "Overview", blockIds: scene.blocks.map((b) => b.id), edgeId: null }];
  scene.edges.forEach((edge, i) => {
    const from = labels.get(edge.from) ?? edge.from;
    const to = labels.get(edge.to) ?? edge.to;
    steps.push({ index: i + 1, caption: edge.label ? `${from} -> ${to}: ${edge.label}` : `${from} -> ${to}`, blockIds: [edge.from, edge.to], edgeId: edge.id });
  });
  return steps;
}

// The spotlight the video recorder renders per step. Null on the overview step,
// which shows the whole scene with nothing dimmed.
export function stepSpotlight(step: WalkStep): Spotlight | null {
  return step.edgeId ? { blockIds: step.blockIds, edgeId: step.edgeId } : null;
}

// Camera framing: zoom toward the step's active blocks so the walkthrough reads
// like a guided tour instead of a static diagram. The overview step frames the
// whole canvas. `stepViewport` is the single source of truth (a rectangle in
// scene coordinates): the HTML player and SVG use it as a transform, and the
// video recorder uses the same rectangle as a canvas crop, so both exports frame
// identical shots. Pure and deterministic.
export const CANVAS = { w: 1280, h: 780 };
export const WALK_ZOOM = 1.32;
export type Viewport = { x: number; y: number; w: number; h: number };

export function stepViewport(scene: SceneDocument, step: WalkStep, zoom = WALK_ZOOM): Viewport {
  const full: Viewport = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };
  if (!step.edgeId) return full;
  const focus = scene.blocks.filter((block) => step.blockIds.includes(block.id));
  if (!focus.length) return full;
  const cx = focus.reduce((sum, b) => sum + b.x + b.w / 2, 0) / focus.length;
  const cy = focus.reduce((sum, b) => sum + b.y + b.h / 2, 0) / focus.length;
  const w = CANVAS.w / zoom;
  const h = CANVAS.h / zoom;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  return { x: clamp(cx - w / 2, 0, CANVAS.w - w), y: clamp(cy - h / 2, 0, CANVAS.h - h), w, h };
}

export function viewportTransform(view: Viewport): string {
  const s = CANVAS.w / view.w;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${round(-view.x * s)} ${round(-view.y * s)}) scale(${round(s)})`;
}

export function stepCamera(scene: SceneDocument, step: WalkStep, zoom = WALK_ZOOM): string {
  return viewportTransform(stepViewport(scene, step, zoom));
}
