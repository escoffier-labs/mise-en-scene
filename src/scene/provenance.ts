import type { SceneBlock, SceneDocument, SceneEdge, SceneFact } from "./types.ts";

// Readable provenance narrative: every block and edge, with linked fact
// evidence text and source offsets. Pure export over the existing scene model.

function factLookup(facts: SceneFact[]): Map<string, SceneFact> {
  return new Map(facts.map((fact) => [fact.id, fact]));
}

function resolveFacts(factIds: string[], byId: Map<string, SceneFact>): SceneFact[] {
  return factIds.map((id) => byId.get(id)).filter((fact): fact is SceneFact => !!fact);
}

function formatEvidence(facts: SceneFact[]): string[] {
  if (!facts.length) return ["  Evidence: No direct source evidence attached."];
  return [
    "  Evidence:",
    ...facts.map((fact) => `    - "${fact.text}" [${fact.start}:${fact.end}]`),
  ];
}

function formatBlock(block: SceneBlock, byId: Map<string, SceneFact>): string[] {
  return [
    `Block: ${block.label}`,
    `  Kind: ${block.kind}`,
    `  Detail: ${block.detail || "(none)"}`,
    ...formatEvidence(resolveFacts(block.factIds, byId)),
    "",
  ];
}

function formatEdge(edge: SceneEdge, labels: Map<string, string>, byId: Map<string, SceneFact>): string[] {
  const from = labels.get(edge.from) ?? edge.from;
  const to = labels.get(edge.to) ?? edge.to;
  const heading = edge.label ? `Edge: ${from} -> ${to}: ${edge.label}` : `Edge: ${from} -> ${to}`;
  return [heading, ...formatEvidence(resolveFacts(edge.factIds, byId)), ""];
}

export function provenanceNarrative(scene: SceneDocument): string {
  const byId = factLookup(scene.facts);
  const labels = new Map(scene.blocks.map((block) => [block.id, block.label]));
  const lines: string[] = [`Provenance: ${scene.title || "Untitled scene"}`];
  if (scene.subtitle) lines.push(scene.subtitle);
  lines.push("", "Elements", "--------", "");

  if (!scene.blocks.length) lines.push("(no blocks)", "");
  else for (const block of scene.blocks) lines.push(...formatBlock(block, byId));

  lines.push("Relationships", "-------------", "");
  if (!scene.edges.length) lines.push("(no relationships)", "");
  else for (const edge of scene.edges) lines.push(...formatEdge(edge, labels, byId));

  return `${lines.join("\n").trimEnd()}\n`;
}
