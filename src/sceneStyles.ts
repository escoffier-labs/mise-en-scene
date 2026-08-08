// Styles for everything rendered inside the scene SVG. Injected via a <style>
// element inside the SVG itself so the live app and exported standalone HTML
// share one stylesheet and cannot drift apart.
//
// Type system: Inter for display, IBM Plex Mono for metadata and detail.
// The ledger palette: ink ground, amber accent, cool greys. Tokens are
// literals (not CSS vars) because this sheet ships inside exported SVGs.

export const T = {
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
} as const;

const sans = `Inter, system-ui, sans-serif`;
const mono = `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

export const sceneCss = `
.scene-title {
  fill: ${T.text};
  font-family: ${sans};
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.scene-summary {
  fill: ${T.dim};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.scene-meta {
  fill: ${T.faint};
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.04em;
}

.zone-frame {
  fill: none;
  stroke: ${T.hairline};
  stroke-dasharray: 4 5;
  stroke-width: 1;
}

.zone-title {
  fill: ${T.muted};
  font-family: ${mono};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.zone-desc {
  fill: ${T.faint};
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.02em;
}

.scene-mode {
  cursor: pointer;
}

.scene-mode rect {
  fill: ${T.panel};
  stroke: ${T.hairlineStrong};
}

.scene-mode:hover rect {
  stroke: ${T.hover};
}

.scene-mode .scene-mode-active {
  fill: ${T.accent};
  stroke: ${T.accent};
}

.scene-mode-text {
  fill: ${T.muted};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 500;
}

.scene-mode-text-active {
  fill: ${T.onAccent};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
}

.flow path {
  fill: none;
  stroke: ${T.edge};
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
  stroke: ${T.accent};
  stroke-width: 1.4;
}

.selected path,
.selected .card-rect {
  stroke: ${T.accent};
  stroke-width: 2.5;
}

.ungrounded {
  opacity: 0.22;
}

.lifeline {
  stroke: ${T.hairlineStrong};
  stroke-width: 1;
  stroke-dasharray: 4 5;
}

.flow-label {
  fill: ${T.dim};
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: ${T.bg};
  stroke-width: 5px;
  stroke-linejoin: round;
}

.flow.active .flow-label {
  fill: ${T.accent};
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
  fill: ${T.card};
  stroke: ${T.hairlineStrong};
  stroke-width: 1;
}

.scene-block:hover .card-rect {
  stroke: ${T.hover};
}

.scene-block.selected .card-rect {
  stroke: ${T.accent};
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
  color: ${T.text};
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
  color: ${T.text};
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
  color: ${T.muted};
  font-family: ${mono};
  font-size: 10.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.callout rect {
  fill: ${T.panel};
  stroke: ${T.accentDeep};
  stroke-width: 1;
}

.callout-title {
  fill: ${T.accent};
  font-family: ${sans};
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.callout p {
  margin: 0;
  color: ${T.muted};
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
  stroke: ${T.accent};
  stroke-width: 2.5;
  filter: drop-shadow(0 6px 16px rgba(224, 164, 92, 0.35));
}
.flow.walk-on path {
  stroke: ${T.accent};
  stroke-width: 2.6;
  filter: drop-shadow(0 0 6px rgba(224, 164, 92, 0.45));
}
.flow.walk-on .flow-label {
  fill: ${T.accent};
  font-weight: 600;
}

/* Review-mode analytic marks: confidence (H/M/L) and competing-hypothesis (?).
   Only rendered when the Review evidence toggle is on. */
.review-mark {
  fill: ${T.accent};
  font-family: ${mono};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: ${T.bg};
  stroke-width: 4px;
  stroke-linejoin: round;
}
.review-mark.competing {
  fill: ${T.hover};
}
.flow.confidence-low path,
.scene-block.confidence-low .card-rect {
  stroke-dasharray: 5 4;
}
.flow.competing-hypothesis path {
  stroke: ${T.hover};
}
.scene-block.competing-hypothesis .card-rect {
  stroke: ${T.hover};
  stroke-dasharray: 3 3;
}
`;
