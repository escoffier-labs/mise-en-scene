// Styles for everything rendered inside the scene SVG. Injected via a <style>
// element inside the SVG itself so the live app and exported standalone HTML
// share one stylesheet and cannot drift apart.
//
// Type system: Newsreader for display, IBM Plex Mono for metadata and detail,
// IBM Plex Sans for card titles. One warm copper accent, used sparingly.

export const fontImport = `@import url("https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap");`;

const serif = `Newsreader, "Iowan Old Style", Palatino, Georgia, serif`;
const mono = `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const sans = `"IBM Plex Sans", system-ui, sans-serif`;

export const sceneCss = `
.scene-title {
  fill: #ece7da;
  font-family: ${serif};
  font-size: 30px;
  font-weight: 500;
}

.scene-summary {
  fill: #6f6d63;
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.scene-meta {
  fill: #565349;
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.04em;
}

.zone-frame {
  fill: none;
  stroke: #2b2a24;
  stroke-dasharray: 4 5;
  stroke-width: 1;
}

.zone-title {
  fill: #7e7b6f;
  font-family: ${mono};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.zone-desc {
  fill: #565349;
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.02em;
}

.scene-mode {
  cursor: pointer;
}

.scene-mode rect {
  fill: #131310;
  stroke: #2e2d27;
}

.scene-mode:hover rect {
  stroke: #56534a;
}

.scene-mode .scene-mode-active {
  fill: #e6e1d2;
  stroke: #e6e1d2;
}

.scene-mode-text {
  fill: #8b887c;
  font-family: ${mono};
  font-size: 10px;
  font-weight: 500;
}

.scene-mode-text-active {
  fill: #131310;
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
}

.flow path {
  fill: none;
  stroke: #45433b;
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
  stroke: #a39d8c;
  stroke-width: 1.4;
}

.flow-label {
  fill: #6f6d63;
  font-family: ${mono};
  font-size: 10px;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: #0c0c0a;
  stroke-width: 5px;
  stroke-linejoin: round;
}

.flow.active .flow-label {
  fill: #c4bdab;
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
  fill: #15140f;
  stroke: #2e2c24;
  stroke-width: 1;
}

.scene-block:hover .card-rect {
  stroke: #4d4a3f;
}

.scene-block.selected .card-rect {
  stroke: #b98a64;
  stroke-width: 1.3;
}

.card {
  padding: 13px 16px;
  pointer-events: none;
}

.card h3 {
  margin: 0 0 5px;
  overflow: hidden;
  color: #efebe0;
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
  color: #898577;
  font-family: ${mono};
  font-size: 10.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.callout rect {
  fill: #16130e;
  stroke: #7c5a40;
  stroke-width: 1;
}

.callout-title {
  fill: #d9b491;
  font-family: ${serif};
  font-size: 17px;
  font-weight: 500;
}

.callout p {
  margin: 0;
  color: #968f7f;
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
  background: #0c0c0a;
  color: #e9e4d7;
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
  color: #ece7da;
  font-family: ${serif};
  font-size: 34px;
  font-weight: 500;
}

h2 {
  margin: 0 0 10px;
  color: #b8b2a2;
  font-family: ${mono};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

p,
li {
  color: #8f8b7d;
}

.scene {
  border: 1px solid #25241e;
  border-radius: 12px;
  background: #0c0c0a;
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
  border: 1px solid #25241e;
  border-radius: 10px;
  padding: 18px;
  background: #11100c;
}

.panel li {
  font-size: 13px;
}

.panel span {
  display: inline-block;
  border: 1px solid #353329;
  border-radius: 999px;
  padding: 4px 10px;
  margin: 3px;
  color: #b8b2a2;
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
