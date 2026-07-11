import { renderToStaticMarkup } from "react-dom/server";
import { SceneSvg } from "../components/SceneSvg";
import { layoutScene } from "./layout";
import type { SceneDocument } from "./types";
import { htmlDocument, svgDocument } from "./exportText";

export function standaloneHtml(scene: SceneDocument) {
  const architecture = renderToStaticMarkup(<SceneSvg scene={layoutScene(scene, "architecture")}/>);
  const sequence = renderToStaticMarkup(<SceneSvg scene={layoutScene(scene, "sequence")}/>);
  return htmlDocument(`<section class="view" data-view="architecture">${architecture}</section><section class="view" data-view="sequence">${sequence}</section>`, scene);
}

export function standaloneSvg(scene: SceneDocument, review = false) {
  return svgDocument(renderToStaticMarkup(<SceneSvg scene={scene} review={review}/>));
}
