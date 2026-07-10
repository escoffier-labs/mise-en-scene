import type { SceneDocument, SceneView } from "./types.ts";

export function layoutScene(document: SceneDocument, view: SceneView): SceneDocument {
  return view === "sequence" ? sequence(document) : architecture(document);
}

function architecture(document: SceneDocument): SceneDocument {
  const columns = [["actor", "source"], ["service", "interface"], ["store", "step"]];
  const positions = new Map<string, { x: number; y: number }>();
  const xs = [72, 532, 992];
  columns.forEach((kinds, column) => {
    const blocks = document.blocks.filter((block) => kinds.includes(block.kind));
    blocks.forEach((block, row) => positions.set(block.id, { x: xs[column], y: 150 + row * Math.min(126, 520 / Math.max(1, blocks.length)) }));
  });
  return { ...document, view: "architecture", blocks: document.blocks.map((block) => ({ ...block, ...(positions.get(block.id) ?? { x: 532, y: 150 }), w: 216, h: 92 })), edges: document.edges.map(({ order: _order, ...edge }) => edge) };
}

function sequence(document: SceneDocument): SceneDocument {
  const ordered: string[] = [];
  for (const edge of document.edges) for (const id of [edge.from, edge.to]) if (!ordered.includes(id)) ordered.push(id);
  for (const block of document.blocks) if (!ordered.includes(block.id)) ordered.push(block.id);
  const gap = Math.min(250, 1120 / Math.max(1, ordered.length));
  const positions = new Map(ordered.map((id, index) => [id, { x: Math.min(1060, 48 + index * gap), y: 126 }]));
  return { ...document, view: "sequence", blocks: document.blocks.map((block) => ({ ...block, ...positions.get(block.id)!, w: Math.min(190, gap - 12), h: 70 })), edges: document.edges.map((edge, order) => ({ ...edge, order })) };
}
