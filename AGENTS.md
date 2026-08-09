# Repository Guidance

## Definition of Done
Before reporting any change complete, run:

```bash
./scripts/verify
```

It runs `npm test` followed by `npm run build` (`tsc -b && vite build`). Report the actual command output. If it fails, report the failure verbatim and do not claim success. Requires Node >= 22.

## Project Shape
- Vite + React 19 + TypeScript single-page app: the Mise en Scene studio, served at app.mise-en-scene.escoffierlabs.dev. The marketing site is a separate repo (mise-en-scene-site) at mise-en-scene.escoffierlabs.dev.
- `src/App.tsx` holds studio state and interactions, including the browser-only adapters (folder read, repo fetch, canvas raster, walkthrough encode). `src/walkthroughRecorder.ts` is the browser encode adapter (MediaBunny + MediaRecorder fallback). `src/scene/` owns the pure, testable model: `types`, `validate`, `extract`, `yaml`, `crawl`, `layout`, `raster`, `walkthrough`, `walkthroughPlan`, `walkthroughEncode`, and `exports`. `src/components/SceneSvg.tsx` is the shared renderer. Standalone exports render the same component via `renderToStaticMarkup`; keep that single-source property.
- Runtime dependencies stay minimal: React, and the approved MediaBunny exception below. Do not add further runtime packages without an explicit exception. The YAML parser (`src/scene/yaml.ts`) remains hand-rolled behind one module so a misparse degrades safely to plain-text extraction. Repository crawling and all exports run in the browser with no backend.

## Approved runtime dependency exception: MediaBunny
- Package: `mediabunny` ^1.52.0 (MPL-2.0, tree-shakable TypeScript media toolkit).
- Purpose only: walkthrough video encode with `CanvasSource`, named `Quality("high")`, and runtime `canEncodeVideo` checks for VP9 WebM (default) and AVC MP4. MediaRecorder WebM remains the fallback when WebCodecs/codec support is missing.
- Out of scope for this exception: HEVC, AV1, and any other codecs or MediaBunny features beyond walkthrough export.
- Notices: keep `THIRD_PARTY_NOTICES.md` (and the MPL-2.0 text it points at) current whenever the MediaBunny version changes.
- `src/sceneStyles.ts`: styles for the SVG internals (injected inside the SVG) plus page chrome for the exported artifact. `src/index.css`: app shell layout and controls. Dimming rules (`ungrounded`, `walk-dim`, `walk-on`) are compound and placed last so they win the specificity tie against `.active`.
- Long text inside SVG nodes uses `foreignObject` + line-clamp to avoid overflow; do not replace with raw `<text>` elements. PNG and video exports rasterize the same SVG, so keep the scene stylesheet free of external resource references to avoid canvas tainting.

## Conventions
- ASCII slugs without accents: repo/app slug `mise-en-scene`, package-safe `mise_scene`, display name `Mise en Scene`.
- Dev server: `npm run dev` on port 5215; preview on 5216.
- No em dashes in copy or docs. No private hostnames, IPs, or personal details in code, comments, or exports.
- Commits: conventional messages, no Co-Authored-By trailers, no AI tooling mentions.
