import { standaloneHtml, standaloneSvg, standaloneWalkthrough } from "../scene/exports.tsx";
import { layoutScene } from "../scene/layout.ts";
import type { SceneDocument, SceneView } from "../scene/types.ts";

export function renderSvgDocument(scene: SceneDocument, view: SceneView, review = false): string {
  return standaloneSvg(layoutScene(scene, view), review);
}

export function renderHtmlDocument(scene: SceneDocument): string {
  return standaloneHtml(scene);
}

export function renderWalkthroughDocument(scene: SceneDocument): string {
  return standaloneWalkthrough(scene);
}

export function renderJsonDocument(scene: SceneDocument, view?: SceneView): string {
  const next = view ? layoutScene(scene, view) : scene;
  return `${JSON.stringify(next, null, 2)}\n`;
}
