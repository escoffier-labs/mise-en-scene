# Scene Themes Implementation Plan

**Goal:** Add a studio-selectable render-time palette that every visual export inherits while preserving the scene schema and existing default output.

**Architecture:** `src/sceneStyles.ts` owns named literal palettes and produces palette-specific embedded CSS. `SceneSvg` resolves one optional theme identifier and uses that palette for CSS, SVG attributes, and background. Export helpers and `App` thread the identifier through without storing presentation in `SceneDocument`.

**Key technology:** React 19, TypeScript, server-side static markup, Node test runner. Execute each task in order and track every checkbox. Do not install packages.

## File map

- `src/sceneStyles.ts`: palette types, built-in palette records, validation, lookup, and CSS generation.
- `src/sceneStyles.test.ts`: palette invariants and literal CSS output.
- `src/components/SceneSvg.tsx`: optional theme prop and palette-specific render.
- `src/scene/exports.tsx`: theme forwarding for HTML, SVG, and walkthrough exports.
- `src/scene/exports.test.ts`: export forwarding coverage.
- `src/App.tsx`: validated persisted selection and theme propagation through live, downloaded, raster, and video paths.

### Task 1: Define literal scene palettes

**Files:**
- Modify: `src/sceneStyles.ts`
- Create: `src/sceneStyles.test.ts`

- [x] Write a failing test that imports `DEFAULT_SCENE_THEME`, `SCENE_THEME_IDS`, `SCENE_THEMES`, `getSceneTheme`, `isSceneThemeId`, and `sceneCssFor`; asserts the default is `ledger`; asserts the IDs are exactly `ledger` and `paper`; verifies `isSceneThemeId` accepts those values and rejects an unknown string; verifies ledger retains `bg: "#0d1014"` and `accent: "#e0a45c"`; verifies paper has different `bg` and `accent`; and verifies `sceneCssFor("paper")` contains the paper text, background-stroke, and accent literals while containing neither `var(` nor `#e0a45c`.
- [x] Run the focused test through Brigade: `brigade work verify run --target . --command "npm test -- src/sceneStyles.test.ts"`. Expect failure because the named exports do not exist. If dependencies are unavailable, record that exact baseline limitation and continue without installing packages.
- [x] Replace the single hardcoded palette with these exact public foundations:

```ts
export type SceneThemeId = "ledger" | "paper";
export type ScenePalette = {
  bg: string; panel: string; card: string; hairline: string;
  hairlineStrong: string; hover: string; text: string; muted: string;
  dim: string; faint: string; accent: string; accentDeep: string;
  onAccent: string; edge: string;
};
export const SCENE_THEME_IDS = ["ledger", "paper"] as const;
export const DEFAULT_SCENE_THEME: SceneThemeId = "ledger";
export const SCENE_THEMES: Record<SceneThemeId, ScenePalette> = {
  ledger: { /* preserve every current T literal */ },
  paper: {
    bg: "#f4f1e8", panel: "#ebe6d8", card: "#fffdf8",
    hairline: "#d0c8b8", hairlineStrong: "#b8ad9b", hover: "#766754",
    text: "#1b1b19", muted: "#4d4a43", dim: "#676259", faint: "#7d766a",
    accent: "#9b4d24", accentDeep: "#6e3519", onAccent: "#fffdf8", edge: "#786f62",
  },
};
export const T = SCENE_THEMES[DEFAULT_SCENE_THEME];
export function isSceneThemeId(value: unknown): value is SceneThemeId {
  return typeof value === "string" && SCENE_THEME_IDS.includes(value as SceneThemeId);
}
export function getSceneTheme(theme: SceneThemeId = DEFAULT_SCENE_THEME): ScenePalette {
  return SCENE_THEMES[theme];
}
```

- [x] Turn the current `sceneCss` template into `sceneCssFor(theme: SceneThemeId = DEFAULT_SCENE_THEME)`, bind `const palette = getSceneTheme(theme)`, and replace each template reference from `T` to `palette`. Preserve `export const sceneCss = sceneCssFor()` for compatibility.
- [x] Run the focused test again through Brigade. Expect all palette tests to pass, or record the unchanged dependency limitation.
- [x] Commit: `git add src/sceneStyles.ts src/sceneStyles.test.ts && git commit -m "feat: add literal scene palettes"`.

### Task 2: Thread the theme through shared rendering and exports

**Files:**
- Modify: `src/components/SceneSvg.tsx`
- Modify: `src/scene/exports.tsx`
- Modify: `src/scene/exports.test.ts`

- [x] Extend the export harness payload with `theme`, forward it to direct `SceneSvg` markup and each standalone helper, then add failing assertions that `paper` export output contains `#f4f1e8` and `#9b4d24`, omits `#0d1014`, and equals direct `SceneSvg` output for standalone SVG. Cover HTML architecture and sequence markup plus walkthrough scene markup.
- [x] Run `brigade work verify run --target . --command "npm test -- src/scene/exports.test.ts"`. Expect themed assertions to fail because the helpers ignore the new value, or record the dependency limitation.
- [x] Add `theme?: SceneThemeId` to `SceneSvg` props. In `SceneSvg`, resolve `const palette = getSceneTheme(theme)` and emit `sceneCssFor(theme)`, `palette.accent`, and `palette.bg` instead of the default constants.
- [x] Use these compatible trailing parameters in `src/scene/exports.tsx`:

```ts
standaloneHtml(scene: SceneDocument, theme: SceneThemeId = DEFAULT_SCENE_THEME)
standaloneSvg(scene: SceneDocument, review = false, spotlight: Spotlight | null = null, camera?: string, theme: SceneThemeId = DEFAULT_SCENE_THEME)
standaloneWalkthrough(scene: SceneDocument, theme: SceneThemeId = DEFAULT_SCENE_THEME)
```

- [x] Pass `theme` to every `SceneSvg` constructed by those helpers.
- [x] Re-run the focused export test through Brigade. Expect all export tests to pass, or record the dependency limitation.
- [x] Commit: `git add src/components/SceneSvg.tsx src/scene/exports.tsx src/scene/exports.test.ts && git commit -m "feat: carry themes through scene exports"`.

### Task 3: Add the persisted studio selector

**Files:**
- Modify: `src/App.tsx`

- [x] Add a failing source-level or render harness test only if an existing App harness supports it. Do not add a DOM test dependency. At minimum, Task 2 tests must already prove the behavioral export contract before this task changes production code.
- [x] Initialize `theme` from `localStorage.getItem("mise-theme")` only when `isSceneThemeId` accepts it, otherwise use `DEFAULT_SCENE_THEME`. Add a labeled `<select aria-label="Scene theme">` with options `Ledger` and `Paper`; on change, update state, persist `mise-theme`, and set the notice to `Theme: Ledger` or `Theme: Paper`.
- [x] Pass `theme` to the live `SceneSvg`, `standaloneHtml`, `standaloneSvg`, and `standaloneWalkthrough` calls. Pass it as the fifth argument to every SVG used for PNG and recorded walkthrough frames. Use `getSceneTheme(theme).bg` for the video canvas fill.
- [x] Run full verification through Brigade: `brigade work verify run --target . --command "./scripts/verify"`. Expect tests and build to pass. If dependencies are unavailable locally, push the branch and require green pull-request CI before review or merge.
- [x] Commit: `git add src/App.tsx docs/plans/2026-08-08-scene-themes.md && git commit -m "feat: add scene theme selector"`.
