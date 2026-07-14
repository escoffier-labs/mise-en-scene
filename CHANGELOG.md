# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Deterministic source-derived blocks, relationships, facts, and evidence ranges.
- Structured OpenAPI JSON extraction for API, tag, and operation elements.
- OpenAPI YAML extraction through a dependency-free parser scoped to the OpenAPI subset.
- Repository crawling in the browser: open a local folder or fetch a public GitHub repo, with Mermaid diagram conversion into the arrow grammar.
- PNG screenshot export that rasterizes the active view.
- Walkthrough exports that give a guided tour of the scene one relationship at a time, with a camera that zooms to each connection, spotlight highlighting, an animated title card, and a progress bar, as a self-contained animated HTML file and as a recorded WebM video.
- Architecture and sequence scene layouts plus an evidence review filter.
- Versioned JSON import and export with validation for untrusted documents.
- Editable block and relationship labels with source evidence navigation.
- Offline interactive HTML export and script-free SVG export from the shared renderer.
- Node-based tests for validation, extraction, layout, editing, YAML, crawling, raster, walkthrough, and export safety.

### Fixed
- Review and walkthrough dimming now win the specificity tie against active elements, so dimmed blocks and edges actually fade.
- Card labels and details now render in PNG and video exports; the `foreignObject` content carries the XHTML namespace so image rasterization keeps it instead of dropping to empty cards.

### Changed
- `tsconfig` uses `moduleResolution: "Bundler"`, the idiomatic setting for the Vite app and forward compatible with newer TypeScript.

## [0.1.0] - 2026-06-27

### Added
- Initial interactive HTML/SVG technical explainer studio for turning repo context, API specs, or README material into editable, shareable diagrams.
- Maintainer-health files: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, GitHub issue templates (`bug`, `feature`, `config` with blank issues disabled), and a pull request template with a no-PII content-guard checkbox.
- A proof screenshot of the live studio near the top of the README (`docs/assets/mise-en-scene-studio.png`): the source panel beside a rendered interactive scene with audience-mode chips, source-grounded facts, and HTML/JSON export, so the README leads with the product working rather than brand art alone.

### Changed
- Redesigned the scene UI toward an editorial diagram aesthetic, then aligned it with the ledger palette and fleet wordmark.
- Refactored SVG rendering so the app and HTML export use one source.
- Added CI, a verify gate, agent guidance, and a fleet-standard README.
- README rewritten to the adoption-upgrade structure: opens with what / why / how-it-differs, leads with the website and studio links, adds a "Why not a general diagram editor?" comparison and a "What Mise en Scene is not" boundaries section, and gives a verified copy-paste quickstart matching the real `npm` scripts.
