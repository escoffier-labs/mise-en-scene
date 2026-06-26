# Contributing to Mise en Scene

Mise en Scene turns source material into self-contained interactive technical explainers. It is part of the [Escoffier Labs](https://mise-en-scene.escoffierlabs.dev) kitchen, and it is an early working spike, so patches are welcome. Before you start, please skim this file so we both spend our time on the right things.

## What kinds of changes land easily

- **Bug fixes** in the scene model, extraction heuristics, the `SceneSvg` component, or the standalone HTML export.
- **Rendering improvements**: clearer layout, better SVG internals, sharper audience-mode framing, more reliable click targets.
- **Export fidelity**: keeping the studio view and the exported artifact in sync (they share one component on purpose).
- **Extraction quality**: better heuristics for pulling systems, actors, flows, terms, and source-grounded facts out of common inputs.
- **Test coverage** or a `./scripts/verify` improvement for any of the above.

## What needs a conversation first

- **A new export target** (screenshot, recorded walkthrough, or a new file format). Open an issue first describing the user story; these are public surface and reworking them later is painful.
- **A new ingestion mode** beyond the current local text heuristics (for example a real repo or OpenAPI crawler). Sketch the approach in an issue first.
- **Breaking changes** to the scene model shape or the export wrapper, since downstream artifacts depend on them.
- **Anything that adds a heavy runtime dependency.** The studio is intentionally lean (React plus Vite); keep new dependencies justified.

## What does not land

- Personal details, hostnames, IPs, account IDs, or live auth profiles in source, fixtures, or sample scenes. The whole point of a shareable export is that it does not leak the machine that made it.
- AI-co-authorship trailers on commits (`Co-Authored-By: <model>`). Conventional commits only.

## Local dev

```bash
git clone https://github.com/escoffier-labs/mise-en-scene.git
cd mise-en-scene
npm install
npm run dev
```

The dev server starts on port `5215`. Before opening a PR, run the single verification gate:

```bash
./scripts/verify      # tsc -b && vite build
```

CI runs the exact same command on every push and pull request, so a green `./scripts/verify` locally means a green build in CI.

## Filing issues

Please use the templates under `.github/ISSUE_TEMPLATE/`. For a rendering or export bug, include the source material you pasted (redacted if needed) and what you expected the scene to show versus what it did. For a feature request, describe the input you have and the explainer you want out of it.

Before posting output, remove tokens, private hostnames, private repo names, and unredacted absolute paths.

## License

By contributing you agree that your contribution is licensed under the MIT License, same as the rest of the repo.
