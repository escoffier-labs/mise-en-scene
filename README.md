# Mise en Scene

Mise en Scene is an Escoffier Labs spike for turning source material into
self-contained interactive technical explainers.

The working product idea:

- paste or ingest a repo, OpenAPI spec, README, incident report, transcript, or
  architecture notes
- extract systems, actors, flows, terms, and source-grounded facts
- generate an editable HTML/SVG scene with mode chips and click targets
- run browser QA and export a standalone artifact

## Development

```bash
npm install
npm run dev
```

The local dev server defaults to `http://localhost:5215`.

## Naming

Use ASCII slugs without accents:

- repo/app slug: `mise-en-scene`
- package-safe variant: `mise_scene`
- display name: `Mise en Scene` or polished mark `Mise en scène`
