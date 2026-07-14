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
  // Participants are the blocks that actually exchange messages, ordered by
  // first appearance. Unconnected blocks are kept in the document (so exports
  // and round trips stay complete) but parked; the renderer only draws
  // participants in sequence view. Slots are sized to the participant count so
  // the row is evenly spread rather than crammed.
  const ordered: string[] = [];
  for (const edge of document.edges) for (const id of [edge.from, edge.to]) if (!ordered.includes(id)) ordered.push(id);
  const participants = ordered.length ? ordered : document.blocks.map((block) => block.id);
  const slots = new Map(participants.map((id, index) => [id, index]));
  const margin = 44;
  const slot = (1280 - margin * 2) / Math.max(1, participants.length);
  const w = Math.min(196, Math.round(slot - 20));
  const place = (id: string) => {
    const index = slots.get(id);
    if (index === undefined) return { x: margin, y: 92, w, h: 60 };
    return { x: Math.round(margin + slot * index + (slot - w) / 2), y: 92, w, h: 60 };
  };
  return { ...document, view: "sequence", blocks: document.blocks.map((block) => ({ ...block, ...place(block.id) })), edges: document.edges.map((edge, order) => ({ ...edge, order })) };
}
