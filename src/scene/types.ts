export type Audience = "engineer" | "exec" | "student" | "customer";
export type SceneView = "architecture" | "sequence";
export type BlockKind = "actor" | "service" | "store" | "interface" | "step" | "source";
export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_LEVELS: Confidence[] = ["high", "medium", "low"];

export type SceneFact = { id: string; text: string; start: number; end: number };
export type SceneBlock = {
  id: string;
  label: string;
  kind: BlockKind;
  detail: string;
  factIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  confidence?: Confidence;
  competingHypothesis?: boolean;
};
export type SceneEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  factIds: string[];
  dashed?: boolean;
  order?: number;
  confidence?: Confidence;
  competingHypothesis?: boolean;
};
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

export function editBlock(
  document: SceneDocument,
  id: string,
  patch: Partial<Pick<SceneBlock, "label" | "detail" | "confidence" | "competingHypothesis">>,
): SceneDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => {
      if (block.id !== id) return block;
      const next = { ...block, ...patch };
      if ("confidence" in patch && patch.confidence === undefined) delete next.confidence;
      if ("competingHypothesis" in patch && patch.competingHypothesis === undefined) delete next.competingHypothesis;
      return next;
    }),
  };
}

export function editEdge(
  document: SceneDocument,
  id: string,
  patch: string | Partial<Pick<SceneEdge, "label" | "confidence" | "competingHypothesis">>,
): SceneDocument {
  const fields = typeof patch === "string" ? { label: patch } : patch;
  return {
    ...document,
    edges: document.edges.map((edge) => {
      if (edge.id !== id) return edge;
      const next = { ...edge, ...fields };
      if ("confidence" in fields && fields.confidence === undefined) delete next.confidence;
      if ("competingHypothesis" in fields && fields.competingHypothesis === undefined) delete next.competingHypothesis;
      return next;
    }),
  };
}
