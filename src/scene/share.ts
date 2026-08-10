// Shareable URL state: gzip + base64url in the location hash (zero backend).
// Prior art: mermaid.live `#pako:` and Excalidraw fragment-carried state.
//
// Binary rule: never TextDecoder("latin1") for bytes. That label is Windows-1252
// in browsers, so gzip bytes in 0x80..0x9f (including the gzip magic 0x8b)
// become non-Latin-1 code points and btoa throws. Use String.fromCharCode on
// raw byte values instead so every 0..255 maps 1:1 into a binary string.

import { DEFAULT_SCENE_THEME, isSceneThemeId, type SceneThemeId } from "../sceneStyles.ts";
import { SCENE_LIMITS, type SceneDocument } from "./types.ts";
import { validateSceneDocument } from "./validate.ts";

export const SHARE_HASH_KEY = "s";
export const SHARE_ENVELOPE_VERSION = 1 as const;

export type ShareEnvelope = {
  v: typeof SHARE_ENVELOPE_VERSION;
  document: SceneDocument;
  theme?: SceneThemeId;
};

export type ShareDecodeResult =
  | { ok: true; value: ShareEnvelope }
  | { ok: false; error: string };

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
// JSON escaping can use six bytes for each allowed source UTF-16 code unit.
// One additional source-sized budget covers the envelope and scene metadata.
const SHARE_DECOMPRESSED_MAX_BYTES = SCENE_LIMITS.source * 7;

/** Convert raw bytes to a URL-safe base64 string without padding. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Decode a URL-safe base64 string into raw bytes. */
export function base64UrlToBytes(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((encoded.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  // Keep CompressionStream construction inside the caller's try/catch boundary.
  const stream = new CompressionStream("gzip");
  const buffer = new ArrayBuffer(input.byteLength);
  new Uint8Array(buffer).set(input);
  const ab = await new Response(new Blob([buffer]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(ab);
}

async function gunzipBytes(input: Uint8Array): Promise<Uint8Array> {
  // Keep DecompressionStream construction inside decodeShareEnvelope's try/catch.
  const stream = new DecompressionStream("gzip");
  const buffer = new ArrayBuffer(input.byteLength);
  new Uint8Array(buffer).set(input);
  const reader = new Blob([buffer]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > SHARE_DECOMPRESSED_MAX_BYTES) {
      try { await reader.cancel(); } finally {
        throw new Error("share payload exceeds the decompressed size limit");
      }
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export function buildShareEnvelope(document: SceneDocument, theme?: SceneThemeId): ShareEnvelope {
  const envelope: ShareEnvelope = { v: SHARE_ENVELOPE_VERSION, document };
  if (theme && theme !== DEFAULT_SCENE_THEME) envelope.theme = theme;
  return envelope;
}

/** Gzip + base64url encode a share envelope. Throws only on unexpected runtime failures. */
export async function encodeShareEnvelope(envelope: ShareEnvelope): Promise<string> {
  const json = JSON.stringify(envelope);
  const compressed = await gzipBytes(new TextEncoder().encode(json));
  return bytesToBase64Url(compressed);
}

export async function decodeShareEnvelope(encoded: string): Promise<ShareDecodeResult> {
  try {
    if (!encoded || !B64URL_RE.test(encoded)) return { ok: false, error: "share payload is not valid base64url" };
    const compressed = base64UrlToBytes(encoded);
    const raw = await gunzipBytes(compressed);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "share payload must be an object" };
    const body = parsed as Record<string, unknown>;
    if (body.v !== SHARE_ENVELOPE_VERSION) return { ok: false, error: "share payload version is unsupported" };
    const validated = validateSceneDocument(body.document);
    if (!validated.ok) return { ok: false, error: validated.error };
    let theme: SceneThemeId | undefined;
    if (body.theme !== undefined) {
      if (!isSceneThemeId(body.theme)) return { ok: false, error: "share theme is unsupported" };
      theme = body.theme;
    }
    return { ok: true, value: { v: SHARE_ENVELOPE_VERSION, document: validated.value, theme } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "share payload could not be decoded" };
  }
}

/** Read the compressed share token from a location hash (`#s=...`). */
export function readShareTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  // Prefer URLSearchParams so `#s=...&other=` stays parseable; fall back to a
  // leading `s=` when the payload is the entire fragment.
  const params = new URLSearchParams(raw);
  const fromParams = params.get(SHARE_HASH_KEY);
  if (fromParams) return fromParams;
  if (raw.startsWith(`${SHARE_HASH_KEY}=`)) return raw.slice(SHARE_HASH_KEY.length + 1);
  return null;
}

export function buildShareHash(token: string): string {
  return `#${SHARE_HASH_KEY}=${token}`;
}

/** Embed mode: `/embed` path or `?embed` / `?embed=1` query (no server rewrite required for query). */
export function isEmbedMode(locationLike: { pathname: string; search: string }): boolean {
  const path = locationLike.pathname.replace(/\/+$/, "") || "/";
  if (path === "/embed" || path.endsWith("/embed")) return true;
  const params = new URLSearchParams(locationLike.search);
  if (!params.has("embed")) return false;
  const value = params.get("embed");
  return value === null || value === "" || value === "1" || value === "true";
}

export function buildStudioShareUrl(origin: string, pathname: string, token: string): string {
  const path = normalizeAppPath(pathname);
  return `${origin}${path}${buildShareHash(token)}`;
}

export function buildEmbedShareUrl(origin: string, pathname: string, token: string): string {
  // Prefer `?embed=1` so static hosts without SPA path rewrites still serve index.html.
  const path = normalizeAppPath(pathname);
  const join = path.includes("?") ? "&" : "?";
  return `${origin}${path}${join}embed=1${buildShareHash(token)}`;
}

function normalizeAppPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/embed" || trimmed.endsWith("/embed")) {
    const root = trimmed.slice(0, -"/embed".length) || "/";
    return root === "/" ? "/" : root;
  }
  return trimmed === "/" ? "/" : trimmed;
}
