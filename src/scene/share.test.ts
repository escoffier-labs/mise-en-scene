import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import {
  SHARE_DECOMPRESSED_MAX_BYTES,
  SHARE_ENCODED_MAX_CHARS,
  bindShareHash,
  buildEmbedUrl,
  buildShareUrl,
  decodeShareEnvelope,
  encodeShareEnvelope,
  readShareTokenFromHash,
} from "./share.ts";
import type { SceneDocument } from "./types.ts";

function sampleDocument(title = "Share fixture"): SceneDocument {
  const document = extractScene("Browser -> API: sends request\nAPI -> Database: reads rows", "engineer").document;
  document.title = title;
  return document;
}

async function gzipBase64url(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function envelopeToken(payload: unknown): Promise<string> {
  return gzipBase64url(new TextEncoder().encode(JSON.stringify(payload)));
}

test("encode and decode round-trip preserves document and optional theme", async () => {
  const document = sampleDocument();
  const token = await encodeShareEnvelope({ document, theme: "paper" });
  assert.ok(token.length > 0);
  assert.ok(token.length <= SHARE_ENCODED_MAX_CHARS);
  assert.match(token, /^[A-Za-z0-9_-]+$/);

  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error(decoded.error);
  assert.equal(decoded.value.theme, "paper");
  assert.equal(decoded.value.document.title, document.title);
  assert.deepEqual(
    decoded.value.document.blocks.map((block) => block.id),
    document.blocks.map((block) => block.id),
  );
});

test("payload without theme hydrates to the canonical ledger default", async () => {
  const document = sampleDocument();
  const token = await encodeShareEnvelope({ document });
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error(decoded.error);
  assert.equal(decoded.value.theme, "ledger");
});

test("byte conversion preserves gzip bytes in the 0x80 through 0x9f range", async () => {
  const document = sampleDocument("Byte range probe");
  document.summary = Array.from({ length: 64 }, (_, i) => String.fromCharCode(0x80 + (i % 32))).join("");
  const token = await encodeShareEnvelope({ document, theme: "ledger" });
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error(decoded.error);
  assert.equal(decoded.value.document.summary, document.summary);

  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  for (let i = 0x80; i <= 0x9f; i++) assert.equal(binary.charCodeAt(i), i);
  assert.equal(typeof btoa(binary), "string");
});

test("literal empty #s= fragment is an invalid share token, not absent", () => {
  assert.equal(readShareTokenFromHash("#s="), "");
  assert.equal(readShareTokenFromHash("#s=&x=1"), "");
  assert.equal(readShareTokenFromHash(""), null);
  assert.equal(readShareTokenFromHash("#view=architecture"), null);
  assert.equal(readShareTokenFromHash("#s=abc"), "abc");
});

test("empty share token fails closed as invalid share", async () => {
  const decoded = await decodeShareEnvelope("");
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene/i);
});

test("unsupported envelope version fails closed", async () => {
  const token = await envelopeToken({ v: 2, document: sampleDocument() });
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene/i);
});

test("unsupported theme fails closed", async () => {
  const token = await envelopeToken({ v: 1, document: sampleDocument(), theme: "neon" });
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene/i);
});

test("invalid document fails closed", async () => {
  const token = await envelopeToken({ v: 1, document: { schemaVersion: 1 } });
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene/i);
});

test("malformed encoding fails closed", async () => {
  const decoded = await decodeShareEnvelope("!!!not-base64url!!!");
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene/i);
});

test("malformed UTF-8 after gunzip fails closed", async () => {
  const token = await gzipBase64url(Uint8Array.from([0xff, 0xfe, 0xfd]));
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene/i);
});

test("producer rejects documents that exceed the decompressed JSON ceiling", async () => {
  const document = sampleDocument();
  document.source.text = "x".repeat(Math.min(SCENE_SOURCE_OVER_BUDGET(), SHARE_DECOMPRESSED_MAX_BYTES));
  await assert.rejects(
    () => encodeShareEnvelope({ document }, { decompressedMaxBytes: 2_000 }),
    /decompressed size limit/i,
  );
});

test("producer rejects tokens that would exceed the encoded character ceiling", async () => {
  const document = sampleDocument();
  await assert.rejects(
    () => encodeShareEnvelope({ document }, { encodedMaxChars: 8 }),
    /encoded|character|too large/i,
  );
});

test("decoder rejects oversized encoded tokens before base64 allocation", async () => {
  const huge = "a".repeat(SHARE_ENCODED_MAX_CHARS + 1);
  const decoded = await decodeShareEnvelope(huge);
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /invalid shared scene|encoded|too large/i);
});

test("decoder enforces decompressed size during gzip expansion", async () => {
  const raw = new Uint8Array(200_000);
  const token = await gzipBase64url(raw);
  const decoded = await decodeShareEnvelope(token, { decompressedMaxBytes: 1_000 });
  assert.equal(decoded.ok, false);
  if (decoded.ok) throw new Error("expected failure");
  assert.match(decoded.error, /decompressed size limit/i);
});

test("buildShareUrl and buildEmbedUrl place the token in the fragment and embed query", async () => {
  const document = sampleDocument();
  const token = await encodeShareEnvelope({ document, theme: "paper" });
  const share = buildShareUrl("https://app.example/studio", token);
  const embed = buildEmbedUrl("https://app.example/studio", token);
  assert.equal(share, `https://app.example/studio#s=${token}`);
  assert.equal(embed, `https://app.example/studio?embed=1#s=${token}`);
  assert.doesNotMatch(embed, /\/embed(\/|$|\?)/);
});

test("bindShareHash replaces tokens, ignores stale async results, and surfaces empty invalid replacements", async () => {
  let hash = "";
  const listeners = new Set<() => void>();
  const events: Array<{ status: string; title?: string; error?: string }> = [];
  let resolveSlow: ((value: Awaited<ReturnType<typeof decodeShareEnvelope>>) => void) | undefined;

  const decode = (token: string) =>
    new Promise<Awaited<ReturnType<typeof decodeShareEnvelope>>>((resolve) => {
      if (token === "slow") {
        resolveSlow = resolve;
        return;
      }
      if (token === "fast") {
        resolve({ ok: true, value: { document: sampleDocument("Fast"), theme: "paper" } });
        return;
      }
      if (token === "ok2") {
        resolve({ ok: true, value: { document: sampleDocument("Second"), theme: "ledger" } });
        return;
      }
      void decodeShareEnvelope(token).then(resolve);
    });

  const binding = bindShareHash({
    getHash: () => hash,
    decode,
    onChange: (state) => {
      if (state.status === "ready") events.push({ status: "ready", title: state.document.title });
      else if (state.status === "error") events.push({ status: "error", error: state.error });
      else events.push({ status: state.status });
    },
    addEventListener: (_type, handler) => {
      listeners.add(handler);
    },
    removeEventListener: (_type, handler) => {
      listeners.delete(handler);
    },
  });

  hash = "#s=slow";
  binding.refresh();
  hash = "#s=fast";
  for (const handler of listeners) handler();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(
    events.filter((event) => event.status === "ready").map((event) => event.title),
    ["Fast"],
  );

  resolveSlow?.({ ok: true, value: { document: sampleDocument("Stale"), theme: "ledger" } });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    events.filter((event) => event.status === "ready").map((event) => event.title),
    ["Fast"],
  );

  hash = "#s=ok2";
  for (const handler of listeners) handler();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    events.filter((event) => event.status === "ready").map((event) => event.title),
    ["Fast", "Second"],
  );

  hash = "#s=";
  for (const handler of listeners) handler();
  await Promise.resolve();
  await Promise.resolve();
  const lastError = [...events].reverse().find((event) => event.status === "error");
  assert.ok(lastError);
  assert.match(lastError!.error || "", /invalid shared scene/i);

  binding.dispose();
  assert.equal(listeners.size, 0);
});

function SCENE_SOURCE_OVER_BUDGET(): number {
  return 50_000;
}
