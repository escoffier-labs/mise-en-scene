# Incident Report Extraction

## Goal

Recognize structured incident and post-incident reports and turn their timeline, indicators, impact, and handoff sections into a source-grounded scene instead of the generic fallback.

## Design

Incident extraction runs after OpenAPI detection and before generic text extraction. It activates only when the source contains an incident signal (`incident`, `postmortem`, `outage`, `breach`, or `compromise`) and at least two recognized Markdown section headings. This prevents ordinary documents with an `Impact` or `Next steps` heading from being misclassified.

Canonical sections and aliases are:

- Timeline: `timeline`, `chronology`, `sequence of events`.
- Indicators: `indicators`, `indicators of compromise`, `iocs`, `evidence`, `detection and analysis`.
- Impact: `impact`, `scope`, `affected systems`.
- Handoff: `handoff`, `next steps`, `ownership`, `recovery`, `post-incident`.

Only recognized sections present in the source become blocks. Blocks use canonical labels in the fixed order Timeline, Indicators, Impact, Handoff. Each block receives facts from Markdown bullets, numbered list items, and the first non-empty prose line in its source section, with exact offsets. Consecutive canonical blocks are connected with `informs` edges carrying the destination section's first fact as evidence. The result uses the source title, an incident-specific summary, no warning, and `fallback: false`. It must remain within model limits and pass `validateSceneDocument`.

OpenAPI, arrow grammar, generic Markdown, and fallback behavior remain byte-for-byte compatible for non-incident inputs. No schema, UI, export, or dependency changes are included.

## Tests

- A four-section incident fixture produces the four canonical blocks, three edges, exact fact offsets, and a valid document.
- Aliases and numbered timeline entries are recognized.
- Reports with two recognized sections produce only those sections and one edge.
- A generic document with an Impact heading but no incident signal stays on the existing path.
- Existing extraction tests stay green.
