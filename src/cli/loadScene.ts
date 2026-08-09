import { readFileSync } from "node:fs";
import { extractScene } from "../scene/extract.ts";
import type { Audience, SceneDocument } from "../scene/types.ts";
import { validateSceneDocument } from "../scene/validate.ts";

export type LoadSceneResult =
  | { ok: true; scene: SceneDocument; source: "json" | "extract" }
  | { ok: false; error: string };

export function loadSceneFromText(text: string, audience: Audience): LoadSceneResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { ok: false, error: "input is empty" };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return { ok: false, error: `invalid JSON: ${error instanceof Error ? error.message : "parse failed"}` };
    }
    const validated = validateSceneDocument(parsed);
    if (validated.ok) return { ok: true, scene: validated.value, source: "json" };
    // Fall through to extraction only when the JSON is not a scene document
    // candidate; a near-miss scene should stay a validation error.
    if (looksLikeSceneDocument(parsed)) {
      return { ok: false, error: `invalid scene JSON: ${validated.error}` };
    }
  }

  const { document } = extractScene(trimmed, audience);
  return { ok: true, scene: document, source: "extract" };
}

export function loadSceneFromPath(path: string, audience: Audience): LoadSceneResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    return { ok: false, error: `cannot read input: ${error instanceof Error ? error.message : "read failed"}` };
  }
  return loadSceneFromText(text, audience);
}

function looksLikeSceneDocument(value: unknown): boolean {
  return !!value && typeof value === "object" && "schemaVersion" in (value as object);
}
