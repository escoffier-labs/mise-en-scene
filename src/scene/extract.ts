import { SCENE_LIMITS, slugId, type Audience, type BlockKind, type SceneBlock, type SceneDocument, type SceneEdge, type SceneFact } from "./types.ts";
import { parseYaml } from "./yaml.ts";

const audienceCopy: Record<Audience, string> = {
  engineer: "Implementation view: interfaces, boundaries, evidence, and failure paths.",
  exec: "Decision view: purpose, ownership, risk, and organizational impact.",
  student: "Teaching view: definitions, sequence, cause and effect, and examples.",
  customer: "Trust view: outcomes, data movement, privacy, and handoff points.",
};

export type ExtractionResult = { document: SceneDocument; fallback: boolean };

export function extractScene(source: string, audience: Audience): ExtractionResult {
  const openapi = parseOpenApi(source);
  return openapi ? extractOpenApi(source, openapi, audience) : extractText(source, audience);
}

function isOpenApi(value: any): value is Record<string, any> {
  return (
    !!value
    && typeof value === "object"
    && Object.prototype.hasOwnProperty.call(value, "openapi")
    && typeof value.openapi === "string"
    && Object.prototype.hasOwnProperty.call(value, "paths")
    && !!value.paths
    && typeof value.paths === "object"
  );
}

function base(source: string, audience: Audience, kind: "text" | "openapi"): SceneDocument {
  return { schemaVersion: 1, title: "Source explainer", subtitle: audienceCopy[audience], summary: "A source-grounded view of systems and flows.", audience, view: "architecture", source: { kind, text: source }, facts: [], terms: [], blocks: [], edges: [], warnings: [] };
}

function extractText(source: string, audience: Audience): ExtractionResult {
  const document = base(source, audience, "text");
  const blockByLabel = new Map<string, SceneBlock>();
  const usedBlocks = new Set<string>();
  const usedFacts = new Set<string>();
  const usedEdges = new Set<string>();
  const addBlock = (label: string, kind: BlockKind = inferKind(label)) => {
    const key = label.trim().toLowerCase();
    let block = blockByLabel.get(key);
    if (!block && document.blocks.length < SCENE_LIMITS.blocks) {
      block = { id: slugId(label, usedBlocks), label: label.trim(), kind, detail: "Extracted from source material.", factIds: [], x: 0, y: 0, w: 216, h: 92 };
      blockByLabel.set(key, block); document.blocks.push(block);
    }
    return block;
  };
  for (const match of source.matchAll(/^\s*([^\n:>-][^\n]*?)\s*->\s*([^\n:]+?)\s*:\s*([^\n]+)\s*$/gm)) {
    if (document.edges.length >= SCENE_LIMITS.edges || document.facts.length >= SCENE_LIMITS.facts) break;
    const from = addBlock(match[1]); const to = addBlock(match[2]);
    if (!from || !to) continue;
    const start = match.index! + match[0].indexOf(match[1]); const text = match[0].trim();
    const fact: SceneFact = { id: slugId(`fact-${text}`, usedFacts), text, start, end: start + text.length };
    document.facts.push(fact); from.factIds.push(fact.id); to.factIds.push(fact.id);
    document.edges.push({ id: slugId(`${from.id}-${to.id}-${match[3]}`, usedEdges), from: from.id, to: to.id, label: match[3].trim(), factIds: [fact.id] });
  }
  let current: SceneBlock | undefined;
  for (const match of source.matchAll(/^(?:#{1,6}\s+(.+)|\s*[-*]\s+(.+))$/gm)) {
    if (match[1]) { current = addBlock(match[1], inferKind(match[1])); continue; }
    const bullet = match[2];
    if (!current || !bullet || document.facts.length >= SCENE_LIMITS.facts) continue;
    const start = match.index! + match[0].indexOf(bullet);
    const fact: SceneFact = { id: slugId(`fact-${bullet}`, usedFacts), text: bullet, start, end: start + bullet.length };
    document.facts.push(fact); current.factIds.push(fact.id); current.detail = fact.text;
  }
  for (const match of source.matchAll(/[^\n.!?][^.!?]*(?:[.!?]|$)/g)) {
    const text = match[0].trim(); if (text.length < 20 || document.facts.length >= SCENE_LIMITS.facts || document.facts.some((f) => f.text === text)) continue;
    const start = match.index! + match[0].indexOf(text); document.facts.push({ id: slugId(`fact-${text}`, usedFacts), text, start, end: start + text.length });
  }
  document.terms = unique([...document.blocks.map((b) => b.label), ...[...source.matchAll(/`([^`]+)`/g)].map((m) => m[1])]).slice(0, SCENE_LIMITS.terms);
  document.title = titleFrom(source);
  if (document.blocks.length < 2 || document.edges.length === 0) return fallback(document, "Fallback extraction used because no explicit relationship was found.");
  document.blocks.forEach((block) => { const fact = document.facts.find((f) => block.factIds.includes(f.id)); if (fact) block.detail = fact.text; });
  return { document, fallback: false };
}

function parseOpenApi(source: string): any | null {
  try {
    const json = JSON.parse(source);
    if (isOpenApi(json)) return json;
  } catch {
    // Not JSON; fall through to the YAML path below.
  }
  // Gate YAML parsing behind a cheap signature check so arbitrary prose is not
  // run through the parser and a misparse can never masquerade as an API.
  if (/^\s*openapi\s*:/m.test(source) && /^\s*paths\s*:/m.test(source)) {
    const yaml = parseYaml(source);
    if (isOpenApi(yaml)) return yaml;
  }
  return null;
}

// Prefer the verbatim source offset (YAML and unescaped JSON), then fall back to
// the JSON-escaped form (quoted JSON strings with escapes).
function factOffset(source: string, text: string): { start: number; end: number } {
  const raw = source.indexOf(text);
  if (raw >= 0) return { start: raw, end: raw + text.length };
  const escaped = JSON.stringify(text).slice(1, -1);
  const escapedStart = source.indexOf(escaped);
  if (escapedStart >= 0) return { start: escapedStart, end: escapedStart + escaped.length };
  return { start: -1, end: -1 };
}

function extractOpenApi(source: string, api: any, audience: Audience): ExtractionResult {
  const document = base(source, audience, "openapi"); document.title = typeof api.info?.title === "string" ? api.info.title : "API";
  const usedBlocks = new Set<string>(), usedEdges = new Set<string>(), usedFacts = new Set<string>();
  const apiBlock = block(document.title, "source", usedBlocks); document.blocks.push(apiBlock);
  const tags = new Map<string, SceneBlock>(); const methods = ["get", "post", "put", "patch", "delete", "options", "head", "trace"];
  outer: for (const [path, item] of Object.entries<any>(api.paths)) {
    if (!item || typeof item !== "object") continue;
    for (const method of methods) {
      const operation = item[method]; if (!operation || typeof operation !== "object") continue;
      const tagName = Array.isArray(operation.tags) && typeof operation.tags[0] === "string" ? operation.tags[0] : "Default";
      let tag = tags.get(tagName);
      const blocksNeeded = (tag ? 0 : 1) + 1;
      const edgesNeeded = (tag ? 0 : 1) + 1;
      if (
        document.blocks.length + blocksNeeded > SCENE_LIMITS.blocks
        || document.edges.length + edgesNeeded > SCENE_LIMITS.edges
        || document.facts.length >= SCENE_LIMITS.facts
      ) break outer;
      if (!tag) { tag = block(tagName, "interface", usedBlocks); tags.set(tagName, tag); document.blocks.push(tag); document.edges.push(edge(apiBlock, tag, "groups", [], usedEdges)); }
      const label = `${method.toUpperCase()} ${path}`; const op = block(label, "step", usedBlocks); const text = operation.summary || operation.description || label;
      const offset = typeof text === "string" ? factOffset(source, text) : { start: -1, end: -1 };
      const fact: SceneFact = { id: slugId(`fact-${text}`, usedFacts), text: String(text), start: offset.start, end: offset.end };
      document.facts.push(fact); op.detail = fact.text; op.factIds = [fact.id]; document.blocks.push(op); document.edges.push(edge(tag, op, method.toUpperCase(), [fact.id], usedEdges));
      document.terms.push(tagName, ...String(path).match(/\{([^}]+)\}/g) ?? []);
    }
  }
  document.terms = unique(document.terms).slice(0, SCENE_LIMITS.terms);
  if (!document.edges.some((e) => e.label !== "groups")) return fallback(document, "OpenAPI document contains no operations; fallback extraction used.");
  return { document, fallback: false };
}

function fallback(document: SceneDocument, warning: string): ExtractionResult {
  const used = new Set<string>(); const factIds = document.facts[0] ? [document.facts[0].id] : [];
  document.blocks = [block("Source", "source", used), block("Process", "service", used), block("Artifact", "step", used)];
  document.blocks[0].factIds = factIds; const edges = new Set<string>();
  document.edges = [edge(document.blocks[0], document.blocks[1], "interpret", factIds, edges), edge(document.blocks[1], document.blocks[2], "explain", [], edges)]; document.warnings = [warning];
  return { document, fallback: true };
}
function block(label: string, kind: BlockKind, used: Set<string>): SceneBlock { return { id: slugId(label, used), label, kind, detail: "Extracted from source material.", factIds: [], x: 0, y: 0, w: 216, h: 92 }; }
function edge(from: SceneBlock, to: SceneBlock, label: string, factIds: string[], used: Set<string>): SceneEdge { return { id: slugId(`${from.id}-${to.id}-${label}`, used), from: from.id, to: to.id, label, factIds }; }
function inferKind(label: string): BlockKind { const s = label.toLowerCase(); if (/database|store|queue|cache/.test(s)) return "store"; if (/api|endpoint|interface/.test(s)) return "interface"; if (/user|client|actor|customer/.test(s)) return "actor"; return "service"; }
function titleFrom(source: string) { return source.split("\n").map((s) => s.replace(/^#+\s*/, "").trim()).find((s) => s.length > 3)?.slice(0, 88) || "Source explainer"; }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }
