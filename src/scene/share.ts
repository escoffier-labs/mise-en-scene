import { DEFAULT_SCENE_THEME, isSceneThemeId, type SceneThemeId } from "../sceneStyles.ts";
import type { SceneDocument } from "./types.ts";
import { validateSceneDocument } from "./validate.ts";

export const SHARE_ENVELOPE_VERSION = 1 as const;
export const SHARE_DECOMPRESSED_MAX_BYTES = 7_000_000;
export const SHARE_ENCODED_MAX_CHARS = 9_333_334;

const INVALID_SHARE = "Invalid shared scene link";

export type SharePayload = {
  document: SceneDocument;
  theme?: SceneThemeId;
};

export type ShareDecodeResult =
  | { ok: true; value: { document: SceneDocument; theme: SceneThemeId } }
  | { ok: false; error: string };

export type ShareHashState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; document: SceneDocument; theme: SceneThemeId }
  | { status: "error"; error: string };

export type ShareLimits = {
  decompressedMaxBytes?: number;
  encodedMaxChars?: number;
};

type ShareEnvelope = {
  v: number;
  document: unknown;
  theme?: unknown;
};

function bytesToBinaryString(bytes: Uint8Array): string {
  // Map every raw byte 1:1. Do not use TextDecoder("latin1"); that applies
  // Windows-1252 and remaps 0x80-0x9f before btoa.
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    out += String.fromCharCode(byte);
  }
  return out;
}

function binaryStringToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): Uint8Array {
  const padded = token + "=".repeat((4 - (token.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return binaryStringToBytes(binary);
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = Uint8Array.from(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipBytesLimited(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  let decompression: DecompressionStream;
  try {
    decompression = new DecompressionStream("gzip");
  } catch {
    throw new Error(INVALID_SHARE);
  }

  const copy = Uint8Array.from(bytes);
  const reader = new Blob([copy]).stream().pipeThrough(decompression).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (size + value.byteLength > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Keep the decompressed-size error classification even if cancel fails.
        }
        throw new Error("share payload exceeds the decompressed size limit");
      }
      chunks.push(value);
      size += value.byteLength;
    }
  } catch (error) {
    if (error instanceof Error && /decompressed size limit/.test(error.message)) throw error;
    throw new Error(INVALID_SHARE);
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(INVALID_SHARE);
  }
}

export async function encodeShareEnvelope(
  payload: SharePayload,
  limits: ShareLimits = {},
): Promise<string> {
  const decompressedMax = limits.decompressedMaxBytes ?? SHARE_DECOMPRESSED_MAX_BYTES;
  const encodedMax = limits.encodedMaxChars ?? SHARE_ENCODED_MAX_CHARS;

  const validated = validateSceneDocument(payload.document);
  if (!validated.ok) throw new Error(validated.error);

  if (payload.theme !== undefined && !isSceneThemeId(payload.theme)) {
    throw new Error("unsupported scene theme");
  }

  const envelope: ShareEnvelope = { v: SHARE_ENVELOPE_VERSION, document: validated.value };
  if (payload.theme !== undefined) envelope.theme = payload.theme;

  const jsonBytes = new TextEncoder().encode(JSON.stringify(envelope));
  if (jsonBytes.byteLength > decompressedMax) {
    throw new Error("share payload exceeds the decompressed size limit");
  }

  const compressed = await gzipBytes(jsonBytes);
  const token = toBase64Url(compressed);
  if (token.length > encodedMax) {
    throw new Error("share payload exceeds the encoded character limit");
  }
  return token;
}

export async function decodeShareEnvelope(
  token: string,
  limits: ShareLimits = {},
): Promise<ShareDecodeResult> {
  const decompressedMax = limits.decompressedMaxBytes ?? SHARE_DECOMPRESSED_MAX_BYTES;
  const encodedMax = limits.encodedMaxChars ?? SHARE_ENCODED_MAX_CHARS;

  try {
    if (typeof token !== "string" || token.length === 0) return { ok: false, error: INVALID_SHARE };
    if (token.length > encodedMax) return { ok: false, error: INVALID_SHARE };
    if (!/^[A-Za-z0-9_-]+$/.test(token)) return { ok: false, error: INVALID_SHARE };

    const compressed = fromBase64Url(token);
    const jsonBytes = await gunzipBytesLimited(compressed, decompressedMax);
    const text = decodeUtf8(jsonBytes);
    const parsed = JSON.parse(text) as ShareEnvelope;
    if (!parsed || typeof parsed !== "object" || parsed.v !== SHARE_ENVELOPE_VERSION) {
      return { ok: false, error: INVALID_SHARE };
    }

    const validated = validateSceneDocument(parsed.document);
    if (!validated.ok) return { ok: false, error: INVALID_SHARE };

    if (parsed.theme !== undefined && !isSceneThemeId(parsed.theme)) {
      return { ok: false, error: INVALID_SHARE };
    }

    return {
      ok: true,
      value: {
        document: validated.value,
        theme: isSceneThemeId(parsed.theme) ? parsed.theme : DEFAULT_SCENE_THEME,
      },
    };
  } catch (error) {
    if (error instanceof Error && /decompressed size limit/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: INVALID_SHARE };
  }
}

/** Returns null when the fragment has no `s` parameter. Empty `#s=` yields "". */
export function readShareTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (!params.has("s")) return null;
  return params.get("s") ?? "";
}

export function buildShareUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.delete("embed");
  url.hash = `s=${token}`;
  return url.toString();
}

export function buildEmbedUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("embed", "1");
  url.hash = `s=${token}`;
  return url.toString();
}

export type BindShareHashOptions = {
  getHash: () => string;
  onChange: (state: ShareHashState) => void;
  decode?: (token: string) => Promise<ShareDecodeResult>;
  addEventListener: (type: "hashchange", handler: () => void) => void;
  removeEventListener: (type: "hashchange", handler: () => void) => void;
};

export function bindShareHash(options: BindShareHashOptions): { refresh: () => void; dispose: () => void } {
  const decode = options.decode ?? decodeShareEnvelope;
  let generation = 0;
  let disposed = false;

  const refresh = () => {
    if (disposed) return;
    const token = readShareTokenFromHash(options.getHash());
    if (token === null) {
      options.onChange({ status: "idle" });
      return;
    }

    const current = ++generation;
    options.onChange({ status: "loading" });
    void decode(token).then((result) => {
      if (disposed || current !== generation) return;
      if (!result.ok) {
        options.onChange({ status: "error", error: result.error });
        return;
      }
      options.onChange({
        status: "ready",
        document: result.value.document,
        theme: result.value.theme,
      });
    });
  };

  const onHashChange = () => {
    refresh();
  };

  options.addEventListener("hashchange", onHashChange);
  refresh();

  return {
    refresh,
    dispose: () => {
      disposed = true;
      generation += 1;
      options.removeEventListener("hashchange", onHashChange);
    },
  };
}
