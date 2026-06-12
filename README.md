<h1 align="center">Mise en Scene</h1>

<p align="center">
  <strong>Turn source material into self-contained interactive technical explainers.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/escoffier-labs/mise-en-scene/ci.yml?branch=main&style=for-the-badge&label=ci" alt="CI status">
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT license">
</p>

The chalkboard out front. Paste a repo, an OpenAPI spec, a README, an incident
report, or architecture notes, and Mise en Scene extracts the systems, actors,
flows, terms, and source-grounded facts, then renders an editable HTML/SVG
scene with audience-mode chips and click targets. Export is a single
standalone HTML artifact you can send to anyone.

Part of the [Escoffier Labs](https://escoffierlabs.dev) kitchen. Site:
[mise-en-scene.escoffierlabs.dev](https://mise-en-scene.escoffierlabs.dev) ·
Studio: [app.mise-en-scene.escoffierlabs.dev](https://app.mise-en-scene.escoffierlabs.dev)

## How it works

- paste or ingest a repo, OpenAPI spec, README, incident report, transcript, or
  architecture notes
- extract systems, actors, flows, terms, and source-grounded facts
- generate an editable HTML/SVG scene with mode chips and click targets
- export a standalone artifact

The standalone HTML export renders the same `SceneSvg` component the live app
uses (via `renderToStaticMarkup`), so exports always match what you saw in the
studio.

## Development

```bash
npm install
npm run dev
```

The local dev server defaults to `http://localhost:5215`. The single
verification gate is `./scripts/verify` (`tsc -b && vite build`).

## Code layout

- `src/App.tsx`: scene model, heuristics, the `SceneSvg` component, and the app
  shell.
- `src/sceneStyles.ts`: styles for the SVG internals (injected inside the SVG)
  plus page chrome for the exported artifact.
- `src/index.css`: app shell layout and controls.

## Status

This is an early working spike. Not implemented yet: screenshot and
recorded-walkthrough export targets, and any real ingestion beyond the local
text heuristics.

## Naming

Use ASCII slugs without accents:

- repo/app slug: `mise-en-scene`
- package-safe variant: `mise_scene`
- display name: `Mise en Scene` or polished mark `Mise en scène`

## License

MIT
