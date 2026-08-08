# Structured Scenes and Round-Trip Exports

## Goal

Turn pasted source material into a source-specific, inspectable scene instead of
relabeling a fixed product diagram. Complete the browser-local workflow with
provenance, editing, JSON round trips, interactive HTML, SVG export, OpenAPI
ingestion, and distinct architecture and sequence layouts.

## Product boundaries

- The studio remains browser-local. It gains no accounts, backend, crawler, model
  API, telemetry, or network-dependent extraction.
- No new runtime dependency is required. OpenAPI JSON and YAML are supported via
  JSON parsing and an isolated hand-rolled YAML parser in `src/scene/yaml.ts`
  scoped to the OpenAPI subset. Unsupported YAML or non-OpenAPI input falls back
  to plain-text extraction.
- Existing stored source, audience, and mode preferences remain valid.
- Imported scene files are treated as untrusted data and validated before use.
- The current sample remains available, but its scene is generated through the
  same public extraction pipeline as user input.

## Architecture

The application is split into five focused layers:

1. `src/scene/types.ts` defines a versioned scene document and validation result.
2. `src/scene/extract.ts` detects OpenAPI JSON or YAML (via `src/scene/yaml.ts`)
   or plain text and returns normalized entities, relationships, facts, and
   evidence ranges.
3. `src/scene/layout.ts` maps normalized content into architecture or sequence
   coordinates without changing semantic IDs.
4. `src/scene/exports.tsx` renders standalone HTML and serializes SVG from the same
   `SceneSvg` component used by the studio.
5. React components own interaction only: source entry, selected-element editing,
   import feedback, layout mode, and export actions.

Pure extraction, validation, layout, and serialization functions are tested with
Node's built-in test runner. Vite and React remain the only application stack.

## Scene document

Exported JSON uses this top-level shape:

```ts
type SceneDocument = {
  schemaVersion: 1;
  title: string;
  subtitle: string;
  summary: string;
  audience: Audience;
  view: SceneView;
  source: {
    kind: "text" | "openapi";
    text: string;
  };
  facts: SceneFact[];
  terms: string[];
  blocks: SceneBlock[];
  edges: SceneEdge[];
  warnings: string[];
};

type SceneFact = {
  id: string;
  text: string;
  start: number;
  end: number;
};

type SceneBlock = {
  id: string;
  label: string;
  kind: "actor" | "service" | "store" | "interface" | "step" | "source";
  detail: string;
  factIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
};

type SceneEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  factIds: string[];
  dashed?: boolean;
  order?: number;
};
```

`SceneView` is `"architecture" | "sequence"`. The existing audience choices are
preserved. Review and export remain presentation filters in the studio rather
than being stored as different graph shapes.

IDs are deterministic slugs with numeric collision suffixes. Extraction of the
same input therefore produces stable block, edge, and fact IDs. Imported edits
survive view changes because layout updates coordinates without replacing IDs.

## Plain-text extraction

Plain text uses an explicit, deterministic grammar followed by conservative
fallbacks:

- A line shaped as `A -> B: label` creates or reuses blocks `A` and `B`, then
  creates a directed edge carrying that line's evidence range.
- Markdown headings create service or step blocks. A heading containing
  `database`, `store`, `queue`, or `cache` becomes a store. A heading containing
  `API`, `endpoint`, or `interface` becomes an interface.
- Bullet lines below a heading become facts attached to that block.
- Sentences are retained as facts with exact character offsets.
- Repeated capitalized phrases and backtick-delimited identifiers may create
  blocks only when they occur at least twice. This avoids turning every noun into
  a node.
- If fewer than two blocks or no relationship can be extracted, the fallback
  scene contains `Source`, `Process`, and `Artifact` blocks with source-backed
  details. The UI states that fallback extraction was used.

Extraction returns at most 12 blocks, 18 edges, 12 facts, and 12 terms. Excess
items are dropped deterministically in source order so the fixed canvas remains
readable.

## OpenAPI extraction

Input is classified as OpenAPI when JSON or YAML parsing succeeds and the root
has an `openapi` string plus a `paths` object. The YAML path is gated by
`openapi:` and `paths:` line signatures before `src/scene/yaml.ts` runs. A parse
failure or non-object result falls back to plain-text extraction rather than
becoming an import error. Invalid JSON follows the same fallback path.

The parser creates:

- one source block for the API, labeled from `info.title` or `API`;
- one interface block per tag, or one `Default` interface when tags are absent;
- one step block per operation, capped in source order;
- edges from the API to tag blocks and from tags to operations;
- facts from operation summaries or descriptions, with the full JSON text as
  their source context when exact string offsets are unavailable;
- terms from tags, path parameters, and referenced schema names.

Unsupported or malformed path items are skipped. A valid OpenAPI document with
no operations receives the normal fallback scene and a visible warning.

## Provenance interaction

Selecting a block or edge opens an inspector containing its editable label and
detail plus its supporting facts. Selecting a supporting fact focuses and
highlights `[start, end)` in the source textarea. OpenAPI facts without reliable
offsets show the supporting text in the inspector without changing selection.

Manual edits affect the current scene document only. Changing source text
regenerates the scene and discards those edits after a confirmation prompt when
edits exist. Audience changes update copy without regeneration. View changes
only recompute coordinates.

## Import and validation

An `Import JSON` file input accepts one UTF-8 `.json` file. Validation checks:

- exact `schemaVersion: 1`;
- required strings and supported enum values;
- finite numeric geometry with positive width and height;
- unique block, edge, and fact IDs;
- edge endpoints and `factIds` reference existing records;
- source text and document collections remain below fixed safety limits.

Invalid files leave the current scene untouched and produce an accessible error
message naming the first invalid field. Valid files replace source and scene
state, mark the document as imported, and can immediately be edited or exported.

## Layouts and modes

Architecture view uses a bounded three-column graph layout based on block kind:
actors and sources, services and interfaces, then stores and terminal steps.
Edges use the existing side-anchored curves.

Sequence view orders blocks by their first appearance in the relationship graph,
places participants across the top, and renders relationships as vertically
ordered message rows. Cycles are retained as later messages rather than used for
ordering participants.

The studio exposes two view buttons, `Architecture` and `Sequence`, plus the
existing `Review` filter, which dims elements without evidence. `Export` is an
action group, not a diagram mode. The selected view is included in JSON and HTML
exports.

## Standalone HTML

The exported document contains:

- static SVG generated by `SceneSvg`;
- the versioned scene JSON in an `application/json` script element;
- a short inline script that switches architecture and sequence views, selects
  blocks and edges, updates the inspector, and supports Enter and Space;
- no remote JavaScript and no application bundle;
- embedded styles and system font fallbacks so the artifact works offline.

The inline script works only with text content and predefined attributes. It
never evaluates imported strings or inserts them as HTML.

## SVG export

`Export SVG` serializes the currently visible `SceneSvg`, adds the SVG namespace,
and embeds the shared scene stylesheet. The exported file reflects the selected
view and evidence filter. It contains no script; interactive behavior belongs to
HTML export.

## UI changes

- Replace the four current mode chips with Architecture, Sequence, and Review.
- Add Import JSON and Export SVG beside the existing export actions.
- Replace the fixed three-card detail rail with a selected-element inspector,
  evidence list, and terms list.
- Permit editing a selected block's label and detail and an edge's label.
- Show extraction kind, fallback state, import errors, and export status through
  an `aria-live` status region.
- Preserve keyboard activation for scene controls and use native labeled inputs
  for editing and importing.

## Failure handling

- Empty input produces an empty-source prompt and disables export until content
  exists.
- Extraction never throws into React rendering; it returns a fallback scene plus
  warnings.
- Import failure is non-destructive.
- If an imported document references unsupported future schema versions, the
  studio asks the user to upgrade the application and does not attempt migration.
- Browser download failures update the status region and preserve the scene.
- Source regeneration confirmation can be cancelled without losing edits.

## Testing and verification

Add `npm test` using TypeScript compilation into a temporary test output folder
and `node --test`. Tests cover:

- plain-text arrows, headings, stable IDs, offsets, caps, and fallback behavior;
- OpenAPI JSON and YAML detection, tagged and untagged operations, malformed path
  items, empty specifications, and YAML fallback behavior.
- scene validation, duplicate IDs, broken references, size limits, and schema
  versions;
- architecture and sequence coordinate stability;
- HTML escaping, embedded scene data, and inline interactivity hooks;
- SVG namespace, embedded styles, and absence of scripts.

`./scripts/verify` runs tests before `npm run build`, and CI continues to use that
single entrypoint. A browser smoke check confirms import, editing, provenance
selection, both views, and all three exports.

## Delivery sequence

1. Scene types, validation, and test harness.
2. Plain-text and OpenAPI extraction with provenance.
3. Architecture and sequence layouts.
4. Studio state, import, editing, evidence highlighting, and regeneration guard.
5. Interactive standalone HTML and SVG exports.
6. Responsive and accessibility polish, documentation, and full verification.

Each step leaves the application buildable and keeps the shared-renderer property
between studio and exports.
