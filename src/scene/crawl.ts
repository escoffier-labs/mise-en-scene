// Repository crawling, browser-local. Given a set of already-read files (from a
// local folder pick or a fetched public repo), pick the single most informative
// one and hand its text to the existing extraction pipeline. This module is pure
// so it is fully testable; the actual folder and network reads live in App.tsx.
//
// Selection order: an OpenAPI spec (structured extraction) wins; otherwise the
// document with the strongest relationship signal, converting an embedded
// Mermaid diagram into the arrow grammar when present.

export type CrawlFile = { path: string; text: string };
export type CrawlResult = { source: string; summary: string; warnings: string[] };
export type RepoRef = { owner: string; repo: string; branch?: string };

export const CRAWL_MAX_FILES = 200;
export const CRAWL_MAX_BYTES = 512 * 1024;
export const REMOTE_CANDIDATE_LIMIT = 80;

export const CRAWL_FILE_CAP_WARNING =
  `Crawl stopped at the ${CRAWL_MAX_FILES}-file limit; additional docs in the folder were not scanned. Open a narrower folder or paste the source directly.`;

export const REMOTE_CANDIDATE_CAP_WARNING =
  `Remote crawl limited to ${REMOTE_CANDIDATE_LIMIT} candidate files; additional docs in the repository were not fetched. Open the folder locally or paste the source directly.`;

export type RemoteCandidateSelection = { paths: string[]; truncated: boolean; eligible: number };

export type TreeBlob = { type: string; path?: string; size?: number };

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "vendor", "coverage", ".next", ".cache", ".vercel"]);
const DOC_EXT = /\.(md|markdown|rst|txt)$/i;
const DATA_EXT = /\.(ya?ml|json)$/i;

export function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

function ignoredPath(path: string): boolean {
  return path.split("/").some((part) => IGNORED_DIRS.has(part)) || /(^|\/)package-lock\.json$/i.test(path) || /\.min\.(js|css)$/i.test(path);
}

export function isCrawlableFile(path: string): boolean {
  return !ignoredPath(path) && (DOC_EXT.test(path) || DATA_EXT.test(path));
}

// Tighter filter for remote crawls to keep the number of raw file fetches small:
// all docs, but data files only when the name hints at an API spec or the file
// sits at the repository root.
export function isRemoteCandidate(path: string): boolean {
  if (!isCrawlableFile(path)) return false;
  if (DOC_EXT.test(path)) return true;
  return /(openapi|swagger|api|spec)/i.test(path) || !path.includes("/");
}

export function selectRemoteCandidatePaths(tree: TreeBlob[]): RemoteCandidateSelection {
  const eligible = tree
    .filter((node) => node.type === "blob" && node.path && isRemoteCandidate(node.path) && (node.size ?? 0) <= CRAWL_MAX_BYTES)
    .map((node) => node.path as string);
  return { paths: eligible.slice(0, REMOTE_CANDIDATE_LIMIT), truncated: eligible.length > REMOTE_CANDIDATE_LIMIT, eligible: eligible.length };
}

export function parseRepoUrl(input: string): RepoRef | null {
  const value = input.trim();
  // Path is optional and stops before ?/# so root URLs with query/fragment still match.
  const github = value.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/([^?#]*))?(?:[?#].*)?$/i);
  if (github) {
    const owner = github[1];
    const repo = github[2];
    const rest = (github[3] ?? "").replace(/\/+$/, "");
    const tree = rest.match(/^tree\/(.+)$/i);
    return { owner, repo, branch: tree?.[1] || undefined };
  }
  const shorthand = value.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };
  return null;
}

export function synthesizeSource(files: CrawlFile[]): CrawlResult {
  const usable = files.filter((file) => file.text && file.text.trim() && isCrawlableFile(file.path));
  if (!usable.length) return { source: "", summary: "No readable files found.", warnings: ["Crawl found no README, docs, or OpenAPI spec."] };

  const specs = usable.filter(isOpenApiFile).sort(byRootThenName);
  if (specs.length) {
    return { source: specs[0].text, summary: `Using OpenAPI spec ${specs[0].path} (scanned ${usable.length} files).`, warnings: specs.length > 1 ? [`${specs.length} OpenAPI specs found; using ${specs[0].path}.`] : [] };
  }

  const docs = usable.filter((file) => DOC_EXT.test(file.path));
  if (!docs.length) return { source: "", summary: `Scanned ${usable.length} files.`, warnings: ["No README or Markdown docs and no OpenAPI spec found."] };
  const readme = docs.find((doc) => /(^|\/)readme(\.[a-z]+)?$/i.test(doc.path));
  const ranked = docs.map((doc) => ({ doc, signal: relationshipSignal(doc.text) })).sort((a, b) => b.signal - a.signal || byRootThenName(a.doc, b.doc));
  const chosen = ranked[0].signal > 0 ? ranked[0].doc : readme ?? [...docs].sort((a, b) => b.text.length - a.text.length)[0];

  const mermaid = mermaidRelations(chosen.text);
  if (mermaid) {
    const heading = firstHeading(chosen.text);
    return { source: (heading ? `# ${heading}\n` : "") + mermaid, summary: `Converted a Mermaid diagram in ${chosen.path} (scanned ${usable.length} files).`, warnings: [] };
  }
  const warnings = relationshipSignal(chosen.text) === 0 ? [`No relationships found in ${chosen.path}; using fallback extraction.`] : [];
  return { source: chosen.text, summary: `Using ${chosen.path} (scanned ${usable.length} files).`, warnings };
}

function isOpenApiFile(file: CrawlFile): boolean {
  if (!DATA_EXT.test(file.path)) return false;
  return /(openapi|swagger)/i.test(file.path) || /(^|\n)\s*["']?openapi["']?\s*:/i.test(file.text) || /(^|\n)\s*["']?swagger["']?\s*:/i.test(file.text);
}

const ARROW_LINE = /^\s*[^\n:>-][^\n]*?\s*->\s*[^\n:]+?\s*:\s*\S/;
function relationshipSignal(text: string): number {
  return text.split("\n").filter((line) => ARROW_LINE.test(line)).length + (/```mermaid/i.test(text) ? 2 : 0);
}

// Convert Mermaid sequence and flowchart edges into the `A -> B: label` grammar.
// Node ids are resolved to their bracket labels when declared (id[Label]).
function mermaidRelations(text: string): string {
  const blocks = [...text.matchAll(/```mermaid\s*([\s\S]*?)```/gi)].map((match) => match[1]);
  if (!blocks.length) return "";
  const lines: string[] = [];
  const labels = new Map<string, string>();
  for (const block of blocks) {
    for (const raw of block.split("\n")) {
      for (const decl of raw.matchAll(/\b([A-Za-z][\w-]*)\s*[[({]([^\])}]+)[\])}]/g)) labels.set(decl[1], decl[2].trim());
    }
  }
  const resolve = (token: string) => {
    const id = token.trim().replace(/[[({].*$/, "").trim();
    return (labels.get(id) ?? id.replace(/["']/g, "")).trim();
  };
  for (const block of blocks) {
    for (const raw of block.split("\n")) {
      const line = raw.trim();
      if (!line || /^(sequenceDiagram|graph|flowchart|subgraph|end|participant|actor|direction|%%|classDef|class |style )/i.test(line)) continue;
      let match = line.match(/^(.+?)\s*--?>>?\s*(.+?)\s*:\s*(.+)$/); // sequence: A->>B: msg
      if (match) { lines.push(`${resolve(match[1])} -> ${resolve(match[2])}: ${match[3].trim()}`); continue; }
      match = line.match(/^(.+?)\s*-{1,2}[.-]?>?\s*\|([^|]+)\|\s*(.+)$/); // flowchart: A -->|label| B
      if (match) { lines.push(`${resolve(match[1])} -> ${resolve(match[3])}: ${match[2].trim()}`); continue; }
      match = line.match(/^(.+?)\s*-{1,2}[.-]?->?\s*(.+)$/); // flowchart: A --> B
      if (match && !/[|:]/.test(match[2])) lines.push(`${resolve(match[1])} -> ${resolve(match[2])}: relates`);
    }
  }
  return lines.join("\n");
}

function firstHeading(text: string): string {
  const heading = text.split("\n").map((line) => line.match(/^#{1,6}\s+(.+)/)?.[1]?.trim()).find(Boolean);
  return heading ? heading.slice(0, 88) : "";
}

function byRootThenName(a: CrawlFile, b: CrawlFile): number {
  const depth = a.path.split("/").length - b.path.split("/").length;
  return depth !== 0 ? depth : a.path.localeCompare(b.path);
}
