# Incident Report Extraction Implementation Plan

**Goal:** Add a guarded incident-report extractor for timeline, indicators, impact, and handoff sections without changing other extraction behavior.

**Architecture:** `extractScene` keeps OpenAPI precedence, then tries a pure `extractIncident` helper before `extractText`. The helper parses Markdown section ranges, canonicalizes aliases, captures bounded evidence with offsets, and returns `null` unless both the incident signal and two-section threshold hold.

**Key technology:** TypeScript regular expressions, the existing scene model helpers, Node test runner. Execute tests first and do not add packages.

## File map

- `src/scene/extract.ts`: incident detection, section parsing, facts, blocks, and edges.
- `src/scene/extract.test.ts`: incident fixtures, aliases, offsets, limits, and false-positive guard.

### Task 1: Add the guarded incident extractor

**Files:**
- Modify: `src/scene/extract.test.ts`
- Modify: `src/scene/extract.ts`

- [x] Add failing tests for the four-section fixture, alias headings, a two-section partial report, exact offsets, `fallback: false`, `validateSceneDocument`, caps, and a generic Impact-only false-positive.
- [x] Run `node --experimental-strip-types --test src/scene/extract.test.ts` through Brigade and observe red before production edits.
- [x] Add `IncidentSection`, the canonical alias table, `extractIncident`, and bounded section fact parsing. Keep OpenAPI first, then incident, then generic text. Use existing `base`, `block`, `edge`, `slugId`, `SCENE_LIMITS`, `titleFrom`, and `unique` helpers.
- [x] Emit canonical blocks in Timeline, Indicators, Impact, Handoff order when present. Use kinds `step`, `source`, `step`, `step`; connect consecutive blocks with `informs`; attach the destination's first fact to each edge.
- [x] Require an incident signal and at least two recognized headings before returning a result. Otherwise return `null` without mutating generic extraction.
- [x] Run the focused test through Brigade and require green.
- [x] Run full `./scripts/verify` through Brigade if dependencies exist. They are absent in this fresh clone and may not be installed, so record that limitation and require green PR CI.
- [ ] Commit code, tests, and checked plan boxes with `feat: extract structured incident reports`.
