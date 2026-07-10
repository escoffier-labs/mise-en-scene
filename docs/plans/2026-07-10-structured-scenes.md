# Structured Scenes Implementation Plan

**Goal:** Replace the fixed demo graph with deterministic, source-derived scenes and complete the browser-local import, edit, provenance, layout, HTML, JSON, and SVG workflow.

**Architecture:** Pure TypeScript modules own the versioned document, extraction, validation, and layout. React owns studio state and rendering. The live studio and all exports continue to use one `SceneSvg` renderer.

**Key tech:** React 19, TypeScript 5.7, Vite 6, Node 22 built-in test runner.

Execute task-by-task, tracking these checkboxes. Every behavior begins with a focused failing test and each task ends with a commit.

## File map

- Create `src/scene/types.ts`: versioned scene types, limits, ID helpers.
- Create `src/scene/validate.ts`: untrusted JSON validation.
- Create `src/scene/extract.ts`: plain-text and OpenAPI extraction.
- Create `src/scene/layout.ts`: architecture and sequence layouts.
- Create `src/scene/exports.tsx`: HTML and SVG serialization.
- Create `src/components/SceneSvg.tsx`: shared scene renderer.
- Create `src/scene/*.test.ts`: focused pure-module tests.
- Modify `src/App.tsx`: studio state, import, edit, provenance, and actions.
- Modify `src/sceneStyles.ts`: graph and sequence presentation.
- Modify `src/index.css`: controls, inspector, warnings, responsive layout.
- Modify `package.json`: Node test command.
- Modify `scripts/verify`: tests followed by production build.
- Modify `README.md`, `CHANGELOG.md`, and `AGENTS.md`: delivered behavior and code map.

### Task 1: Versioned document and validation

**Files:** Create `src/scene/types.ts`, `src/scene/validate.ts`, `src/scene/validate.test.ts`; modify `package.json`, `tsconfig.json`, `scripts/verify`.

- [ ] Add `npm test` as `node --experimental-strip-types --test "src/**/*.test.ts"`, enable `allowImportingTsExtensions`, and make `./scripts/verify` run tests before build.
- [ ] Write a failing validator test which imports `validateSceneDocument`, accepts a minimal schema-v1 document, rejects duplicate IDs and dangling edge endpoints, and asserts the first error path.

```ts
test("rejects dangling endpoints without replacing the document", () => {
  const value = fixture();
  value.edges[0].to = "missing";
  assert.deepEqual(validateSceneDocument(value), {
    ok: false,
    error: "edges[0].to references an unknown block",
  });
});
```

- [ ] Run `npm test -- --test-name-pattern="dangling endpoints"`; expect failure because the module does not exist.
- [ ] Implement the exact schema from the approved spec, `SCENE_LIMITS`, deterministic `slugId`, and `validateSceneDocument(value): {ok:true; value:SceneDocument}|{ok:false; error:string}`. Validate size limits, enums, finite geometry, positive sizes, uniqueness, fact references, and endpoints in stable field order.
- [ ] Run `npm test`; expect all validator tests to pass. Run `npm run build`; expect success.
- [ ] Commit with `git add package.json tsconfig.json scripts/verify src/scene && git commit -m "feat: add versioned scene validation"`.

### Task 2: Source extraction and provenance

**Files:** Create `src/scene/extract.ts`, `src/scene/extract.test.ts`.

- [ ] Write failing tests for `A -> B: label`, heading and bullet attachment, exact sentence offsets, stable collision IDs, caps, and fallback warnings. Assert block labels, edge endpoints, and `[start,end)` slices.
- [ ] Run `npm test -- --test-name-pattern="plain text"`; expect failure because `extractScene` is missing.
- [ ] Implement `extractScene(source, audience): ExtractionResult`. Parse arrow lines first, Markdown headings and bullets second, sentence facts third, then repeated backtick/capitalized terms. Preserve source order, enforce limits, and return the three-block fallback when fewer than two blocks or no edge exists.
- [ ] Write failing OpenAPI tests for tagged operations, missing tags, malformed path entries, operation caps, and a valid document with no operations.
- [ ] Run `npm test -- --test-name-pattern="OpenAPI"`; expect the first OpenAPI assertion to fail.
- [ ] Add OpenAPI JSON detection and extraction. Create API, tag, and operation blocks; connect them in source order; derive facts from summary/description and terms from tags, parameters, and `$ref` schema tails. Skip unsupported values and fall back with a warning when no operations exist.
- [ ] Run `npm test`; expect extraction and validation tests to pass.
- [ ] Commit with `git add src/scene && git commit -m "feat: extract source-grounded scenes"`.

### Task 3: Architecture and sequence layouts

**Files:** Create `src/scene/layout.ts`, `src/scene/layout.test.ts`.

- [ ] Write failing tests proving architecture columns follow block kinds, sequence participants follow first graph appearance, cycles do not duplicate participants, message order follows edge order, and repeated calls return identical coordinates.
- [ ] Run `npm test -- --test-name-pattern="layout"`; expect failure because layout functions are missing.
- [ ] Implement `layoutScene(document, view)` as a pure function. Architecture uses three bounded columns and fixed card sizes. Sequence places participants across the top and assigns `order` to edge copies while retaining semantic IDs. Clamp all coordinates to the 1280 by 780 canvas.
- [ ] Run `npm test`; expect all tests to pass.
- [ ] Commit with `git add src/scene && git commit -m "feat: add architecture and sequence layouts"`.

### Task 4: Shared renderer and exports

**Files:** Create `src/components/SceneSvg.tsx`, `src/scene/exports.tsx`, `src/scene/exports.test.ts`; modify `src/sceneStyles.ts`.

- [ ] Write failing tests for standalone HTML escaping, embedded schema-v1 JSON, mode and selection hooks, SVG namespace and embedded styles, and the absence of scripts in SVG.
- [ ] Run `npm test -- --test-name-pattern="export"`; expect failure because serializers are missing.
- [ ] Move the SVG renderer out of `App.tsx`. Render architecture with side-anchored curves and sequence with participants, lifelines, and ordered messages. Apply `data-block-id`, `data-edge-id`, and evidence classes. Keep `foreignObject` for wrapped card text.
- [ ] Implement `standaloneHtml(document, options)` with escaped static markup, a JSON script whose `<` characters are Unicode escaped, and a dependency-free inline controller for view switching, keyboard activation, selection, and inspector updates. Implement `sceneSvg(document, options)` by rendering the shared component, adding `xmlns`, and embedding `sceneCss` without scripts.
- [ ] Run `npm test`; expect all tests to pass. Run `npm run build`; expect success.
- [ ] Commit with `git add src/components src/scene src/sceneStyles.ts && git commit -m "feat: add shared interactive exports"`.

### Task 5: Studio round trip, editing, and evidence interaction

**Files:** Modify `src/App.tsx`, `src/index.css`.

- [ ] Add a failing pure state test in `src/scene/edit.test.ts` for immutable block and edge edits and view-only relayout preserving IDs. Run it and expect missing helpers.
- [ ] Add minimal edit helpers to `src/scene/types.ts`, rerun the focused test, and expect pass.
- [ ] Replace the fixed studio state with a generated or imported `SceneDocument`. Add Architecture, Sequence, and Review controls; Import JSON; Export HTML, JSON, and SVG; selected block/edge editing; extraction warnings; import errors; and an accessible status region.
- [ ] On valid import, replace the source and document. On invalid import, retain both. Track manual edits. Before source regeneration after edits, use `window.confirm`; cancellation restores the prior source text and scene. Audience updates subtitle copy without regenerating IDs. Review dims elements with no `factIds`.
- [ ] Evidence buttons call `textarea.setSelectionRange(start,end)` and focus the source. Facts without usable offsets remain readable but do not change the selection.
- [ ] Run `npm test` and `npm run build`; expect success.
- [ ] Commit with `git commit -am "feat: add scene import editing and provenance"`.

### Task 6: Documentation and end-to-end verification

**Files:** Modify `README.md`, `CHANGELOG.md`, `AGENTS.md`; update plan checkboxes.

- [ ] Update the README jobs, limitations, export descriptions, and code layout to match the delivered implementation. Document OpenAPI JSON, the text arrow grammar, JSON round trips, offline HTML, and static SVG.
- [ ] Record all seven capabilities under `CHANGELOG.md` Unreleased. Update `AGENTS.md` with the new module boundaries and test gate.
- [ ] Start `npm run dev`, then verify in a browser: plain-text arrows create source-specific nodes; OpenAPI JSON creates tag and operation nodes; evidence selection highlights text; edits persist across view changes; invalid import is non-destructive; valid JSON reimports; architecture and sequence differ; HTML interactions work offline; SVG opens and contains no script.
- [ ] Run `./scripts/verify`; expect Node tests to pass followed by a successful TypeScript and Vite production build.
- [ ] Mark every completed checkbox in this plan and commit with `git commit -am "docs: document structured scene workflow"`.

## Completion criteria

All seven approved capabilities are present, the original browser-local and shared-renderer constraints remain intact, imported data is validated, every pure behavior has been observed failing before implementation, browser smoke checks pass, and `./scripts/verify` exits zero.
