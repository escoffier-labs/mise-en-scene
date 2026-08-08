<p align="center">
  <img src="docs/assets/mise-en-scene-social-preview.jpg" alt="Mise en Scene banner" width="900">
</p>

<h1 align="center">Mise en Scene</h1>

<p align="center">
  <img src="docs/assets/marks/mise-en-scene-circle.svg" alt="" width="40" height="40">
</p>

<p align="center">
  <strong>Turn a repo or incident report into an interactive explainer you can ship.</strong>
</p>

<p align="center">
  Browser studio that extracts systems, actors, and source-grounded facts into editable HTML/SVG scenes. Same component for live preview and standalone export.
</p>

<p align="center">
  <a href="https://mise-en-scene.escoffierlabs.dev">Website</a> &middot; <a href="https://app.mise-en-scene.escoffierlabs.dev">Studio</a> &middot; <a href="#install">Install</a>
</p>

<p align="center">
  <img src="https://shieldcn.dev/github/ci/escoffier-labs/mise-en-scene.svg?branch=main&workflow=ci.yml" alt="CI status">
  <img src="https://shieldcn.dev/badge/version-0.1.0-blue.svg" alt="Version 0.1.0">
  <img src="https://shieldcn.dev/badge/license-MIT-green.svg" alt="MIT license">
</p>

## Install

Requires Node.js 22 or newer.

```bash
git clone https://github.com/escoffier-labs/mise-en-scene.git
cd mise-en-scene
npm install
./scripts/verify
npm run dev
```

## What it does

| | Job | What you get |
|---|---|---|
| **Ingest** | Source material | Pasted text, a local folder, a public repo, OpenAPI JSON or YAML |
| **Extract** | Source-grounded facts | Systems, actors, flows, terms, and evidence ranges |
| **Stage** | Interactive scene | Architecture and sequence views, editing, review |
| **Export** | Portable artifacts | Interactive HTML, JSON, SVG, PNG, and a walkthrough (HTML or WebM) |

<p align="center">
  <img src="docs/assets/mise-en-scene-studio.png" alt="Mise en Scene studio" width="760">
</p>

<p align="center"><em>Studio on the left, scene on the right. Standalone export uses the same SceneSvg component.</em></p>


## Source grammar

Paste prose, Markdown, OpenAPI JSON or YAML, or explicit relationships:

```text
Browser -> API: sends request
API -> Database: reads rows
```

Relationship lines produce deterministic blocks, edges, and source evidence.
OpenAPI JSON and YAML produce API, tag, and operation elements. When the source
does not contain a usable relationship, the studio clearly marks its fallback
scene.

## Ingest a repository

Beyond pasting, the studio can pull source material from a repo without a
backend:

- **Open folder** reads a local repository in the browser (File System Access
  API, with a directory-upload fallback). It picks the most informative file, an
  OpenAPI spec when present, otherwise the README or the doc with the strongest
  relationship signal, and converts an embedded Mermaid diagram into the arrow
  grammar.
- **From URL** fetches a public GitHub repository's docs and specs directly from
  the browser (two API calls plus raw file reads), then extracts the same way.

## Exports

JSON exports use a validated, versioned schema and can be imported for another
editing session. HTML exports work offline and retain view switching and element
inspection. SVG exports contain the active view and no scripts. PNG exports
rasterize the active view. The walkthrough export gives a guided tour of the
scene one relationship at a time, with a camera that zooms to each connection
and spotlight highlighting, as a self-contained animated HTML file or a recorded
WebM video.

## Example

The [`examples/`](examples/) directory holds a full run built from one short
source file ([`brigade-source.md`](examples/brigade-source.md)) describing an
orchestration pipeline and its sidecars.

<p align="center">
  <img src="examples/brigade-scene-sequence.png" alt="Sequence view of the example scene" width="820">
</p>

- **Scene:** [interactive HTML](examples/brigade-scene.html) with architecture
  and sequence views, plus [PNG](examples/brigade-scene.png) and
  [SVG](examples/brigade-scene.svg) stills.
- **Walkthrough:** [animated HTML](examples/brigade-walkthrough.html) and a
  recorded [WebM video](examples/brigade-walkthrough.webm), both a guided tour
  that zooms to each relationship.

## Code layout

- `src/App.tsx`: studio state, import, editing, provenance, and export actions.
- `src/components/SceneSvg.tsx`: shared architecture and sequence renderer.
- `src/scene/types.ts`: versioned scene model and editing helpers.
- `src/scene/extract.ts`: plain-text and OpenAPI (JSON and YAML) extraction.
- `src/scene/yaml.ts`: dependency-free YAML parser scoped to the OpenAPI subset.
- `src/scene/crawl.ts`: repository crawling, file selection, and Mermaid conversion.
- `src/scene/layout.ts`: deterministic architecture and sequence layouts.
- `src/scene/validate.ts`: imported JSON validation.
- `src/scene/exports.tsx`: standalone HTML, SVG, and walkthrough serialization.
- `src/scene/raster.ts`: SVG-to-PNG raster helpers.
- `src/scene/walkthrough.ts`: the shared tour model for the walkthrough exports.
- `src/sceneStyles.ts`: styles for the SVG internals (injected inside the SVG)
  plus the page chrome for the exported artifact.
- `src/index.css`: app shell layout and controls.

## Why not a general diagram editor?

- **Excalidraw, draw.io, and friends** are freeform canvases. You place every
  box by hand and nothing connects the drawing back to the source. Mise en Scene
  starts from your actual source material and keeps the scene grounded in
  extracted facts.
- **Mermaid and PlantUML** turn text into a fixed diagram, but the output is a
  static picture with one audience in mind. Mise en Scene renders an editable,
  interactive scene with audience-mode chips and click targets, and exports it as
  a self-contained interactive HTML file rather than a flat image.
- **Slide decks and screenshots** go stale the moment the system changes and
  carry no structure a reader can explore. A Mise en Scene export is one HTML
  file, openable anywhere, with the scene model behind it.

## What Mise en Scene is not

Mise en Scene is an early working spike, not a finished product.

It is not:

- a hosted service or an account-gated SaaS (it runs in your browser)
- a server-side crawler (repository ingestion happens locally in the browser)
- a full YAML parser (OpenAPI YAML is parsed as a documented subset; malformed
  or exotic YAML falls back to plain-text extraction)
- a replacement for hand-authored long-form docs

## Status

This is an early working product. Source-derived scenes, evidence inspection,
architecture and sequence views, JSON round trips, editing, repository crawling
(local folders and public repos), OpenAPI JSON and YAML, and HTML, SVG, JSON,
PNG, and walkthrough exports work today. Repository crawling and OpenAPI YAML run
entirely in the browser. PNG and walkthrough exports rasterize the scene, so they
depend on browser support for `foreignObject` rasterization (Chromium and
Firefox); video recording uses `MediaRecorder` and falls back to a clear notice
where unsupported.

## Naming

Use ASCII slugs without accents:

- repo/app slug: `mise-en-scene`
- package-safe variant: `mise_scene`
- display name: `Mise en Scene` or polished mark `Mise en scène`

Part of the [Escoffier Labs](https://mise-en-scene.escoffierlabs.dev) kitchen.

## Contributing

Bug reports and patches are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for
the contribution path and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community
expectations. Security reports go through [SECURITY.md](SECURITY.md), not public
issues.

## License

MIT. See [LICENSE](LICENSE).
