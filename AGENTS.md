# Repository Guidance

## Definition of Done
Before reporting any change complete, run:

```bash
./scripts/verify
```

It runs `npm test` followed by `npm run build` (`tsc -b && vite build`). Report the actual command output. If it fails, report the failure verbatim and do not claim success. Requires Node >= 22.

## Project Shape
- Vite + React 19 + TypeScript single-page app: the Mise en Scene studio, served at app.mise-en-scene.escoffierlabs.dev. The marketing site is a separate repo (mise-en-scene-site) at mise-en-scene.escoffierlabs.dev.
- `src/App.tsx` holds studio state and interactions, including the browser-only adapters (folder read, repo fetch, canvas raster, MediaRecorder). `src/scene/` owns the pure, testable model: `types`, `validate`, `extract`, `yaml`, `crawl`, `layout`, `raster`, `walkthrough`, and `exports`. `src/components/SceneSvg.tsx` is the shared renderer. Standalone exports render the same component via `renderToStaticMarkup`; keep that single-source property.
- Zero runtime dependencies beyond React. Keep it that way: the YAML parser (`src/scene/yaml.ts`) is hand-rolled behind one module so a misparse degrades safely to plain-text extraction. Repository crawling and all exports run in the browser with no backend.
- `src/sceneStyles.ts`: styles for the SVG internals (injected inside the SVG) plus page chrome for the exported artifact. `src/index.css`: app shell layout and controls. Dimming rules (`ungrounded`, `walk-dim`, `walk-on`) are compound and placed last so they win the specificity tie against `.active`.
- Long text inside SVG nodes uses `foreignObject` + line-clamp to avoid overflow; do not replace with raw `<text>` elements. PNG and video exports rasterize the same SVG, so keep the scene stylesheet free of external resource references to avoid canvas tainting.

## Conventions
- ASCII slugs without accents: repo/app slug `mise-en-scene`, package-safe `mise_scene`, display name `Mise en Scene`.
- Dev server: `npm run dev` on port 5215; preview on 5216.
- No em dashes in copy or docs. No private hostnames, IPs, or personal details in code, comments, or exports.
- Commits: conventional messages, no Co-Authored-By trailers, no AI tooling mentions.
