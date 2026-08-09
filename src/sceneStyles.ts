// Styles for everything rendered inside the scene SVG. Injected via a <style>
// element inside the SVG itself so the live app and exported standalone HTML
// share one stylesheet and cannot drift apart.
//
// Type system: Inter for display, IBM Plex Mono for metadata and detail.
// Themes are named literal palettes (not CSS vars) because this sheet ships
// inside exported SVGs.

export type SceneThemeId = "ledger" | "paper";
export type ScenePalette = {
  bg: string; panel: string; card: string; hairline: string;
  hairlineStrong: string; hover: string; text: string; muted: string;
  dim: string; faint: string; accent: string; accentDeep: string;
  onAccent: string; edge: string;
};

export const SCENE_THEME_IDS = ["ledger", "paper"] as const;
export const DEFAULT_SCENE_THEME: SceneThemeId = "ledger";

export const SCENE_THEMES: Record<SceneThemeId, ScenePalette> = {
  ledger: {
    bg: "#0d1014",
    panel: "#11161c",
    card: "#121821",
    hairline: "#232b34",
    hairlineStrong: "#2a323d",
    hover: "#43505e",
    text: "#dde3ea",
    muted: "#9aa4b2",
    dim: "#7d8590",
    faint: "#5c6672",
    accent: "#e0a45c",
    accentDeep: "#9c6f3a",
    onAccent: "#0d1014",
    edge: "#38424e",
  },
  paper: {
    bg: "#f4f1e8",
    panel: "#ebe6d8",
    card: "#fffdf8",
    hairline: "#d0c8b8",
    hairlineStrong: "#b8ad9b",
    hover: "#766754",
    text: "#1b1b19",
    muted: "#4d4a43",
    dim: "#676259",
    faint: "#7d766a",
    accent: "#9b4d24",
    accentDeep: "#6e3519",
    onAccent: "#fffdf8",
    edge: "#786f62",
  },
};

export const T = SCENE_THEMES[DEFAULT_SCENE_THEME];

export function isSceneThemeId(value: unknown): value is SceneThemeId {
  return typeof value === "string" && SCENE_THEME_IDS.includes(value as SceneThemeId);
}

export function getSceneTheme(theme: SceneThemeId = DEFAULT_SCENE_THEME): ScenePalette {
  return SCENE_THEMES[theme];
}

const sans = `Inter, system-ui, sans-serif`;
const mono = `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

export function sceneCssFor(theme: SceneThemeId = DEFAULT_SCENE_THEME) {
  const palette = getSceneTheme(theme);
  return `
.scene-title {
  fill: ${palette.text};
  font-family: ${sans};
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.scene-summary {
  fill: ${palette.dim};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.scene-meta {
  fill: ${palette.faint};
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.04em;
}

.zone-frame {
  fill: none;
  stroke: ${palette.hairline};
  stroke-dasharray: 4 5;
  stroke-width: 1;
}

.zone-title {
  fill: ${palette.muted};
  font-family: ${mono};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.zone-desc {
  fill: ${palette.faint};
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.02em;
}

.scene-mode {
  cursor: pointer;
}

.scene-mode rect {
  fill: ${palette.panel};
  stroke: ${palette.hairlineStrong};
}

.scene-mode:hover rect {
  stroke: ${palette.hover};
}

.scene-mode .scene-mode-active {
  fill: ${palette.accent};
  stroke: ${palette.accent};
}

.scene-mode-text {
  fill: ${palette.muted};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 500;
}

.scene-mode-text-active {
  fill: ${palette.onAccent};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
}

.flow path {
  fill: none;
  stroke: ${palette.edge};
  stroke-width: 1.1;
}

.flow.dashed path {
  stroke-dasharray: 4 5;
}

.flow {
  opacity: 0.35;
}

.flow.active {
  opacity: 1;
}

.flow.active path {
  stroke: ${palette.accent};
  stroke-width: 1.4;
}

.selected path,
.selected .card-rect {
  stroke: ${palette.accent};
  stroke-width: 2.5;
}

.ungrounded {
  opacity: 0.22;
}

.lifeline {
  stroke: ${palette.hairlineStrong};
  stroke-width: 1;
  stroke-dasharray: 4 5;
}

.flow-label {
  fill: ${palette.dim};
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: ${palette.bg};
  stroke-width: 5px;
  stroke-linejoin: round;
}

.flow.active .flow-label {
  fill: ${palette.accent};
}

.scene-block {
  cursor: pointer;
  opacity: 0.35;
}

.scene-block.active,
.scene-block.selected {
  opacity: 1;
}

.card-rect {
  fill: ${palette.card};
  stroke: ${palette.hairlineStrong};
  stroke-width: 1;
}

.scene-block:hover .card-rect {
  stroke: ${palette.hover};
}

.scene-block.selected .card-rect {
  stroke: ${palette.accent};
  stroke-width: 1.3;
}

.card {
  padding: 13px 16px;
  pointer-events: none;
}

/* Sequence participant header: centered, wrapping name, no detail paragraph. */
.participant {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 10px;
  text-align: center;
  pointer-events: none;
}

.participant span {
  display: -webkit-box;
  overflow: hidden;
  color: ${palette.text};
  font-family: ${sans};
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card h3 {
  margin: 0 0 5px;
  overflow: hidden;
  color: ${palette.text};
  font-family: ${sans};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: ${palette.muted};
  font-family: ${mono};
  font-size: 10.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.callout rect {
  fill: ${palette.panel};
  stroke: ${palette.accentDeep};
  stroke-width: 1;
}

.callout-title {
  fill: ${palette.accent};
  font-family: ${sans};
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.callout p {
  margin: 0;
  color: ${palette.muted};
  font-family: ${mono};
  font-size: 10.5px;
  line-height: 1.5;
}

/* Dimming and spotlight overrides. These are compound and placed last so they
   win the specificity tie against .scene-block.active / .flow.active (which pin
   opacity to 1). "ungrounded" is the Review-evidence filter; "walk-*" is the
   walkthrough spotlight applied by the animated HTML player and the video
   recorder. Inert until a class is set, so the live studio is unaffected. */
.stage-camera {
  transform-box: view-box;
  transform-origin: 0 0;
}
.scene-block {
  transform-box: fill-box;
  transform-origin: center;
}
.scene-block.ungrounded,
.flow.ungrounded {
  opacity: 0.22;
}
.scene-block.walk-dim,
.flow.walk-dim {
  opacity: 0.14;
  transition: opacity 0.4s ease;
}
.scene-block.walk-on,
.flow.walk-on {
  opacity: 1;
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.scene-block.walk-on {
  transform: scale(1.05);
}
.scene-block.walk-on .card-rect {
  stroke: ${palette.accent};
  stroke-width: 2.5;
  filter: drop-shadow(0 6px 16px rgba(224, 164, 92, 0.35));
}
.flow.walk-on path {
  stroke: ${palette.accent};
  stroke-width: 2.6;
  filter: drop-shadow(0 0 6px rgba(224, 164, 92, 0.45));
}
.flow.walk-on .flow-label {
  fill: ${palette.accent};
  font-weight: 600;
}

/* Review-mode analytic marks: confidence (H/M/L) and competing-hypothesis (?).
   Only rendered when the Review evidence toggle is on. */
.review-mark {
  fill: ${palette.accent};
  font-family: ${mono};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: ${palette.bg};
  stroke-width: 4px;
  stroke-linejoin: round;
}
.review-mark.competing {
  fill: ${palette.hover};
}
.flow.confidence-low path,
.scene-block.confidence-low .card-rect {
  stroke-dasharray: 5 4;
}
.flow.competing-hypothesis path {
  stroke: ${palette.hover};
}
.scene-block.competing-hypothesis .card-rect {
  stroke: ${palette.hover};
  stroke-dasharray: 3 3;
}
`;
}

export const sceneCss = sceneCssFor();
