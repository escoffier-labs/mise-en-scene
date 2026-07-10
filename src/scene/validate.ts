import { SCENE_LIMITS, type Audience, type BlockKind, type SceneDocument, type SceneView } from "./types.ts";

type Result = { ok: true; value: SceneDocument } | { ok: false; error: string };
const audiences: Audience[] = ["engineer", "exec", "student", "customer"];
const views: SceneView[] = ["architecture", "sequence"];
const kinds: BlockKind[] = ["actor", "service", "store", "interface", "step", "source"];

export function validateSceneDocument(value: unknown): Result {
  if (!value || typeof value !== "object") return bad("document must be an object");
  const v = value as Record<string, any>;
  if (v.schemaVersion !== 1) return bad("schemaVersion must be 1");
  for (const key of ["title", "subtitle", "summary"] as const) if (typeof v[key] !== "string") return bad(`${key} must be a string`);
  if (!audiences.includes(v.audience)) return bad("audience is unsupported");
  if (!views.includes(v.view)) return bad("view is unsupported");
  if (!v.source || !["text", "openapi"].includes(v.source.kind) || typeof v.source.text !== "string") return bad("source must contain kind and text");
  if (v.source.text.length > SCENE_LIMITS.source) return bad("source.text exceeds the size limit");
  for (const key of ["facts", "terms", "blocks", "edges", "warnings"]) if (!Array.isArray(v[key])) return bad(`${key} must be an array`);
  for (const key of ["facts", "terms", "blocks", "edges"] as const) if (v[key].length > SCENE_LIMITS[key]) return bad(`${key} exceeds the size limit`);
  const factIds = new Set<string>();
  for (let i = 0; i < v.facts.length; i++) {
    const fact = v.facts[i];
    if (!fact || typeof fact.id !== "string" || typeof fact.text !== "string" || !Number.isInteger(fact.start) || !Number.isInteger(fact.end) || fact.start < -1 || fact.end < fact.start) return bad(`facts[${i}] is invalid`);
    if (factIds.has(fact.id)) return bad(`facts[${i}].id must be unique`);
    factIds.add(fact.id);
  }
  const blockIds = new Set<string>();
  for (let i = 0; i < v.blocks.length; i++) {
    const block = v.blocks[i];
    if (!block || typeof block.id !== "string" || typeof block.label !== "string" || typeof block.detail !== "string" || !kinds.includes(block.kind) || !Array.isArray(block.factIds)) return bad(`blocks[${i}] is invalid`);
    if (blockIds.has(block.id)) return bad(`blocks[${i}].id must be unique`);
    for (const field of ["x", "y", "w", "h"]) if (!Number.isFinite(block[field]) || ((field === "w" || field === "h") && block[field] <= 0)) return bad(`blocks[${i}].${field} is invalid`);
    for (const id of block.factIds) if (!factIds.has(id)) return bad(`blocks[${i}].factIds references an unknown fact`);
    blockIds.add(block.id);
  }
  const edgeIds = new Set<string>();
  for (let i = 0; i < v.edges.length; i++) {
    const edge = v.edges[i];
    if (!edge || typeof edge.id !== "string" || typeof edge.from !== "string" || typeof edge.to !== "string" || typeof edge.label !== "string" || !Array.isArray(edge.factIds)) return bad(`edges[${i}] is invalid`);
    if (edgeIds.has(edge.id)) return bad(`edges[${i}].id must be unique`);
    if (!blockIds.has(edge.from)) return bad(`edges[${i}].from references an unknown block`);
    if (!blockIds.has(edge.to)) return bad(`edges[${i}].to references an unknown block`);
    for (const id of edge.factIds) if (!factIds.has(id)) return bad(`edges[${i}].factIds references an unknown fact`);
    edgeIds.add(edge.id);
  }
  return { ok: true, value: value as SceneDocument };
}

function bad(error: string): Result { return { ok: false, error }; }
