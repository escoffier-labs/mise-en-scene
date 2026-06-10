// Styles for everything rendered inside the scene SVG. Injected via a <style>
// element inside the SVG itself so the live app and exported standalone HTML
// share one stylesheet and cannot drift apart.
export const sceneCss = `
.stage-wash {
  fill: #10130e;
  opacity: 0.52;
}

.stage-grid {
  stroke: #24241f;
  stroke-width: 1;
}

.zone-frame {
  fill: rgba(255, 255, 255, 0.012);
  stroke: #37372f;
  stroke-dasharray: 5 5;
  stroke-width: 1;
}

.scene-title {
  fill: #f1efe7;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 24px;
  font-weight: 500;
}

.scene-summary {
  fill: #77766f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.zone-title {
  fill: #77766f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.scene-mode {
  cursor: pointer;
}

.scene-mode rect {
  fill: #151613;
  stroke: #32332d;
}

.scene-mode .scene-mode-active {
  fill: #e9e5d9;
  stroke: #e9e5d9;
}

.scene-mode-text {
  fill: #918f84;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
}

.scene-mode-text-active {
  fill: #11120f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 900;
}

.flow {
  opacity: 0.17;
}

.flow path:first-child {
  fill: none;
  stroke: #77766e;
  stroke-width: 1.1;
}

.flow.active {
  opacity: 1;
}

.flow.active path:first-child {
  stroke: #cbc4b4;
  stroke-width: 1.9;
}

.flow textPath {
  fill: #6f6d65;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

.flow.active textPath {
  fill: #d7d0c0;
}

.scene-block {
  cursor: pointer;
  opacity: 0.32;
}

.scene-block.active,
.scene-block.selected {
  opacity: 1;
}

.scene-block rect:first-child {
  stroke-width: 1;
}

.scene-block.active rect:first-child {
  stroke-width: 1.7;
}

.scene-block.selected rect:first-child {
  stroke-width: 2.2;
}

.block-kicker {
  fill: #8b8a82;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.block-label {
  fill: #f1efe7;
  font-size: 14px;
  font-weight: 800;
}

.block-zone {
  fill: #aaa79a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
}

.callout rect {
  fill: #181814;
  stroke: #4b4336;
}

.callout-title {
  fill: #f1efe7;
  font-size: 15px;
  font-weight: 800;
}

.callout p {
  margin: 0;
  color: #aaa79a;
  font:
    12px/1.35 ui-monospace,
    SFMono-Regular,
    Menlo,
    Consolas,
    monospace;
}
`;

// Page chrome for the exported standalone HTML artifact, matching the app's
// warm palette.
export const standaloneCss = `
body {
  margin: 0;
  background: #0a0b0a;
  color: #eeeae1;
  font: 15px/1.5 Inter, ui-sans-serif, system-ui, sans-serif;
}

main {
  max-width: 1260px;
  margin: auto;
  padding: 24px;
}

h1 {
  margin: 0 0 8px;
  color: #f3efe5;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 32px;
  font-weight: 500;
}

p {
  color: #a9a79c;
}

.scene {
  border: 1px solid #282923;
  border-radius: 12px;
  background: #0b0c0b;
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
  border: 1px solid #282923;
  border-radius: 10px;
  padding: 16px;
  background: #121310;
}

.panel li {
  color: #a9a79c;
}

.panel span {
  display: inline-block;
  border: 1px solid #3a3a33;
  border-radius: 999px;
  padding: 4px 9px;
  margin: 3px;
  color: #c7c0b1;
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
