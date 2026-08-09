import { renderToStaticMarkup } from "react-dom/server";
import { SceneSvg } from "../components/SceneSvg";
import { DEFAULT_SCENE_THEME, type SceneThemeId } from "../sceneStyles";
import { layoutScene } from "./layout";
import type { SceneDocument } from "./types";
import { htmlDocument, svgDocument, walkthroughHtml } from "./exportText";
import { stepCamera, walkthroughSteps, type Spotlight } from "./walkthrough";

export function standaloneHtml(scene: SceneDocument, theme: SceneThemeId = DEFAULT_SCENE_THEME) {
  const architecture = renderToStaticMarkup(<SceneSvg scene={layoutScene(scene, "architecture")} theme={theme}/>);
  const sequence = renderToStaticMarkup(<SceneSvg scene={layoutScene(scene, "sequence")} theme={theme}/>);
  return htmlDocument(`<section class="view" data-view="architecture">${architecture}</section><section class="view" data-view="sequence">${sequence}</section>`, scene);
}

export function standaloneSvg(scene: SceneDocument, review = false, spotlight: Spotlight | null = null, camera?: string, theme: SceneThemeId = DEFAULT_SCENE_THEME) {
  return svgDocument(renderToStaticMarkup(<SceneSvg scene={scene} review={review} spotlight={spotlight} camera={camera} theme={theme}/>));
}

// Offline animated walkthrough: the shared renderer plus the tour model from
// walkthrough.ts, driven client-side by the controller in walkthroughHtml. The
// scene is rendered inside an identity camera group so the player can ease the
// camera between the per-step transforms embedded alongside each step.
export function standaloneWalkthrough(scene: SceneDocument, theme: SceneThemeId = DEFAULT_SCENE_THEME) {
  const laid = layoutScene(scene, "architecture");
  const steps = walkthroughSteps(laid).map((step) => ({ ...step, camera: stepCamera(laid, step) }));
  const markup = renderToStaticMarkup(<SceneSvg scene={laid} camera="translate(0 0) scale(1)" theme={theme}/>);
  return walkthroughHtml(markup, steps);
}
