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
