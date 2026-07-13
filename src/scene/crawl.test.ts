import assert from "node:assert/strict";
import test from "node:test";
import { isCrawlableFile, isRemoteCandidate, parseRepoUrl, synthesizeSource } from "./crawl.ts";
import { extractScene } from "./extract.ts";

test("an OpenAPI spec wins over documentation", () => {
  const result = synthesizeSource([
    { path: "README.md", text: "# Project\nSome prose about the project." },
    { path: "openapi.yaml", text: "openapi: 3.1.0\ninfo:\n  title: API\npaths:\n  /x:\n    get:\n      summary: Get x" },
  ]);
  assert.match(result.source, /openapi: 3\.1\.0/);
  assert.match(result.summary, /openapi\.yaml/);
});

test("a README arrow diagram is chosen and extracts to real blocks", () => {
  const result = synthesizeSource([
    { path: "docs/notes.md", text: "Just prose, nothing structured here at all." },
    { path: "README.md", text: "Web -> API: submits cart\nAPI -> Database: stores order" },
  ]);
  const doc = extractScene(result.source, "engineer").document;
  assert.deepEqual(doc.blocks.map((b) => b.label), ["Web", "API", "Database"]);
  assert.equal(doc.warnings.length, 0);
});

test("a Mermaid sequence diagram is converted into the arrow grammar", () => {
  const readme = "# Flow\n```mermaid\nsequenceDiagram\n  participant U as User\n  U->>API: request\n  API-->>DB: query\n```\n";
  const result = synthesizeSource([{ path: "README.md", text: readme }]);
  const doc = extractScene(result.source, "engineer").document;
  assert.deepEqual(doc.edges.map((e) => e.label), ["request", "query"]);
  assert.match(result.summary, /Mermaid/);
});

test("a Mermaid flowchart resolves node labels", () => {
  const readme = "```mermaid\nflowchart LR\n  A[Web App] -->|calls| B[Payments API]\n```";
  const result = synthesizeSource([{ path: "README.md", text: readme }]);
  assert.match(result.source, /Web App -> Payments API: calls/);
});

test("no usable files yields an empty source and a warning", () => {
  const result = synthesizeSource([{ path: "src/index.ts", text: "export const x = 1" }]);
  assert.equal(result.source, "");
  assert.equal(result.warnings.length, 1);
});

test("parseRepoUrl accepts full URLs, tree refs, and shorthand", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/escoffier-labs/mise-en-scene"), { owner: "escoffier-labs", repo: "mise-en-scene", branch: undefined });
  assert.deepEqual(parseRepoUrl("https://github.com/octocat/hello/tree/dev/x"), { owner: "octocat", repo: "hello", branch: "dev" });
  assert.deepEqual(parseRepoUrl("octocat/hello"), { owner: "octocat", repo: "hello" });
  assert.equal(parseRepoUrl("not a repo"), null);
});

test("crawl filters skip vendored and lockfiles; remote narrows data files", () => {
  assert.equal(isCrawlableFile("node_modules/pkg/readme.md"), false);
  assert.equal(isCrawlableFile("package-lock.json"), false);
  assert.equal(isCrawlableFile("docs/guide.md"), true);
  assert.equal(isRemoteCandidate("config/tsconfig.json"), false);
  assert.equal(isRemoteCandidate("openapi.json"), true);
  assert.equal(isRemoteCandidate("README.md"), true);
});
