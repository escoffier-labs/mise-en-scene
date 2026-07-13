import { renderToStaticMarkup } from "react-dom/server";
import { SceneSvg } from "../components/SceneSvg";
import { layoutScene } from "./layout";
import type { SceneDocument } from "./types";
import { htmlDocument, svgDocument, walkthroughHtml } from "./exportText";
import { walkthroughSteps, type Spotlight } from "./walkthrough";

export function standaloneHtml(scene: SceneDocument) {
  const architecture = renderToStaticMarkup(<SceneSvg scene={layoutScene(scene, "architecture")}/>);
  const sequence = renderToStaticMarkup(<SceneSvg scene={layoutScene(scene, "sequence")}/>);
  return htmlDocument(`<section class="view" data-view="architecture">${architecture}</section><section class="view" data-view="sequence">${sequence}</section>`, scene);
}

export function standaloneSvg(scene: SceneDocument, review = false, spotlight: Spotlight | null = null) {
  return svgDocument(renderToStaticMarkup(<SceneSvg scene={scene} review={review} spotlight={spotlight}/>));
}

// Offline animated walkthrough: the shared renderer plus the tour model from
// walkthrough.ts, driven client-side by the controller in walkthroughHtml.
export function standaloneWalkthrough(scene: SceneDocument) {
  const laid = layoutScene(scene, "architecture");
  const markup = renderToStaticMarkup(<SceneSvg scene={laid}/>);
  return walkthroughHtml(markup, walkthroughSteps(laid));
}
