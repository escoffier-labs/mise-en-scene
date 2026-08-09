# Scene Themes

## Goal

Let a user switch the scene palette in the studio and have SVG, PNG, HTML, walkthrough HTML, WebM, and MP4 outputs use the selected palette without changing the scene document schema.

## Design

Themes are named literal color records in `src/sceneStyles.ts`. `ledger` preserves every current color and remains the default. `paper` supplies a light, print-friendly alternative. A renderer resolves the selected theme once, generates the embedded CSS from its literal colors, and uses the same record for SVG attributes and video canvas fills. The generated SVG must contain literal colors, not CSS custom properties or external resources.

`SceneSvg` accepts an optional `theme` identifier. The three standalone export helpers accept the same optional identifier and pass it to every `SceneSvg` render. Existing callers that omit the identifier retain the current ledger output. The studio keeps the selected identifier in component state and `localStorage` under `mise-theme`, validates stored values, exposes a labeled theme selector, and passes the value to the live renderer and every visual export path. JSON and provenance exports remain scene-data exports and do not include the presentation choice.

## Public API

- `SceneThemeId` is `"ledger" | "paper"`.
- `SCENE_THEME_IDS`, `DEFAULT_SCENE_THEME`, `SCENE_THEMES`, `isSceneThemeId`, `getSceneTheme`, and `sceneCssFor` are exported by `src/sceneStyles.ts`.
- `SceneSvg` adds `theme?: SceneThemeId`.
- `standaloneHtml(scene, theme?)`, `standaloneSvg(scene, review?, spotlight?, camera?, theme?)`, and `standaloneWalkthrough(scene, theme?)` keep their current arguments and add only optional trailing theme arguments.

## Tests and constraints

- Tests prove the default ledger colors remain unchanged.
- Tests prove paper colors are embedded as literals and ledger-only colors are absent from themed SVG, HTML, and walkthrough scene markup.
- Tests prove all standalone helpers forward the requested theme.
- The full repository verification remains `./scripts/verify`.
- No package or runtime dependency changes are allowed.
