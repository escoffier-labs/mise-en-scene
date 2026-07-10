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

export const fontImport = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");`;

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
`;

// Page chrome for the exported standalone HTML artifact, matching the app.
export const standaloneCss = `
${fontImport}

body {
  margin: 0;
  background: ${T.bg};
  color: ${T.text};
  font-family: ${sans};
  font-size: 15px;
  line-height: 1.5;
}

main {
  max-width: 1280px;
  margin: auto;
  padding: 28px;
}

h1 {
  margin: 0 0 6px;
  color: ${T.text};
  font-family: ${sans};
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

h2 {
  margin: 0 0 10px;
  color: ${T.accent};
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

p,
li {
  color: ${T.muted};
}

.scene {
  border: 1px solid ${T.hairline};
  border-radius: 12px;
  background: ${T.bg};
  overflow: hidden;
}

.scene svg {
  width: 100%;
  height: auto;
  display: block;
}

.meta {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  margin-top: 16px;
}

.panel {
  border: 1px solid ${T.hairline};
  border-radius: 10px;
  padding: 18px;
  background: ${T.panel};
}

.panel li {
  font-size: 13px;
}

.panel span {
  display: inline-block;
  border: 1px solid ${T.hairlineStrong};
  border-radius: 999px;
  padding: 4px 10px;
  margin: 3px;
  color: ${T.muted};
  font-family: ${mono};
  font-size: 11px;
}

@media (max-width: 780px) {
  main {
    padding: 14px;
  }

  .meta {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 24px;
  }
}
`;
