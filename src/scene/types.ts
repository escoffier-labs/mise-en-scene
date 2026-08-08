export type Audience = "engineer" | "exec" | "student" | "customer";
export type SceneView = "architecture" | "sequence";
export type BlockKind = "actor" | "service" | "store" | "interface" | "step" | "source";

export type SceneFact = { id: string; text: string; start: number; end: number };
export type SceneBlock = { id: string; label: string; kind: BlockKind; detail: string; factIds: string[]; x: number; y: number; w: number; h: number };
export type SceneEdge = { id: string; from: string; to: string; label: string; factIds: string[]; dashed?: boolean; order?: number };
export type SceneDocument = {
  schemaVersion: 1;
  title: string;
  subtitle: string;
  summary: string;
  audience: Audience;
  view: SceneView;
  source: { kind: "text" | "openapi"; text: string };
  facts: SceneFact[];
  terms: string[];
  blocks: SceneBlock[];
  edges: SceneEdge[];
  warnings: string[];
};

export const SCENE_LIMITS = { source: 1_000_000, facts: 12, terms: 12, blocks: 12, edges: 18, warnings: 12 } as const;

export function slugId(value: string, used: Set<string>) {
  const root = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  let id = root;
  let suffix = 2;
  while (used.has(id)) id = `${root}-${suffix++}`;
  used.add(id);
  return id;
}

export function editBlock(document: SceneDocument, id: string, patch: Partial<Pick<SceneBlock, "label" | "detail">>): SceneDocument {
  return { ...document, blocks: document.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) };
}

export function editEdge(document: SceneDocument, id: string, label: string): SceneDocument {
  return { ...document, edges: document.edges.map((edge) => edge.id === id ? { ...edge, label } : edge) };
}
