import assert from "node:assert/strict";
import test from "node:test";
import { extractScene } from "./extract.ts";
import {
  base64UrlToBytes,
  buildEmbedShareUrl,
  buildShareEnvelope,
  buildShareHash,
  buildStudioShareUrl,
  bytesToBase64Url,
  decodeShareEnvelope,
  encodeShareEnvelope,
  isEmbedMode,
  readShareTokenFromHash,
  SHARE_DECOMPRESSED_MAX_BYTES,
  SHARE_ENCODED_MAX_CHARS,
  SHARE_ENVELOPE_VERSION,
} from "./share.ts";
import { SCENE_LIMITS } from "./types.ts";

const sample = extractScene("Browser -> API: sends request\nAPI -> Database: reads rows", "engineer").document;

test("bytesToBase64Url preserves every byte including 0x80 through 0x9f", () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  const encoded = bytesToBase64Url(bytes);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(encoded.includes("+"), false);
  assert.equal(encoded.includes("/"), false);
  assert.equal(encoded.includes("="), false);
  assert.deepEqual(base64UrlToBytes(encoded), bytes);
});

test("gzip magic 0x1f 0x8b survives base64url round-trip (latin1 trap)", async () => {
  // Gzip headers always include 0x8b, which Windows-1252 TextDecoder("latin1")
  // maps away from a Latin-1 code point and breaks btoa.
  const token = await encodeShareEnvelope(buildShareEnvelope(sample));
  const bytes = base64UrlToBytes(token);
  assert.equal(bytes[0], 0x1f);
  assert.equal(bytes[1], 0x8b);
  assert.ok([...bytes].some((b) => b >= 0x80 && b <= 0x9f), "fixture must include C1-range bytes");
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.v, SHARE_ENVELOPE_VERSION);
    assert.equal(decoded.value.document.title, sample.title);
    assert.equal(decoded.value.document.blocks.length, sample.blocks.length);
    assert.equal(decoded.value.theme, undefined);
  }
});

test("encode/decode round-trips document edits and paper theme", async () => {
  const edited = {
    ...sample,
    title: "Shared checkout",
    blocks: sample.blocks.map((block, i) => (i === 0 ? { ...block, label: "Web client" } : block)),
  };
  const token = await encodeShareEnvelope(buildShareEnvelope(edited, "paper"));
  const decoded = await decodeShareEnvelope(token);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.theme, "paper");
    assert.equal(decoded.value.document.title, "Shared checkout");
    assert.equal(decoded.value.document.blocks[0]?.label, "Web client");
  }
});

test("decodeShareEnvelope rejects corrupt, invalid, and unsupported payloads", async () => {
  assert.equal((await decodeShareEnvelope("!!!")).ok, false);
  assert.equal((await decodeShareEnvelope(bytesToBase64Url(new Uint8Array([1, 2, 3, 4])))).ok, false);

  const badVersion = bytesToBase64Url(
    await new Response(
      new Blob([new TextEncoder().encode(JSON.stringify({ v: 99, document: sample }))])
        .stream()
        .pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer().then((ab) => new Uint8Array(ab)),
  );
  const badVersionResult = await decodeShareEnvelope(badVersion);
  assert.equal(badVersionResult.ok, false);
  if (!badVersionResult.ok) assert.match(badVersionResult.error, /version/i);

  const badDoc = bytesToBase64Url(
    await new Response(
      new Blob([new TextEncoder().encode(JSON.stringify({ v: 1, document: { schemaVersion: 1 } }))])
        .stream()
        .pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer().then((ab) => new Uint8Array(ab)),
  );
  assert.equal((await decodeShareEnvelope(badDoc)).ok, false);
});

test("decodeShareEnvelope rejects highly compressed output before scene validation", async () => {
  const oversizedJson = JSON.stringify({
    v: SHARE_ENVELOPE_VERSION,
    document: {
      ...sample,
      source: { ...sample.source, text: "x".repeat(SCENE_LIMITS.source * 7) },
    },
  });
  const compressed = new Uint8Array(await new Response(
    new Blob([new TextEncoder().encode(oversizedJson)])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer());
  assert.ok(compressed.byteLength < oversizedJson.length / 100, "fixture must be highly compressed");

  assert.deepEqual(
    await decodeShareEnvelope(bytesToBase64Url(compressed)),
    { ok: false, error: "share payload exceeds the decompressed size limit" },
  );
});

test("hash and URL helpers parse embed mode and share tokens", () => {
  assert.equal(readShareTokenFromHash(""), null);
  assert.equal(readShareTokenFromHash("#s=abc"), "abc");
  assert.equal(readShareTokenFromHash("#s=abc&x=1"), "abc");
  assert.equal(buildShareHash("tok"), "#s=tok");

  assert.equal(isEmbedMode({ pathname: "/", search: "" }), false);
  assert.equal(isEmbedMode({ pathname: "/embed", search: "" }), true);
  assert.equal(isEmbedMode({ pathname: "/embed/", search: "" }), true);
  assert.equal(isEmbedMode({ pathname: "/", search: "?embed=1" }), true);
  assert.equal(isEmbedMode({ pathname: "/", search: "?embed" }), true);
  assert.equal(isEmbedMode({ pathname: "/", search: "?embed=0" }), false);

  assert.equal(
    buildStudioShareUrl("https://app.example", "/", "tok"),
    "https://app.example/#s=tok",
  );
  assert.equal(
    buildStudioShareUrl("https://app.example", "/embed", "tok"),
    "https://app.example/#s=tok",
  );
  assert.equal(
    buildEmbedShareUrl("https://app.example", "/", "tok"),
    "https://app.example/?embed=1#s=tok",
  );
  assert.equal(
    buildEmbedShareUrl("https://app.example", "/studio/", "tok"),
    "https://app.example/studio?embed=1#s=tok",
  );
});

test("share encoded max is derived from the decompressed byte cap", () => {
  assert.equal(SHARE_DECOMPRESSED_MAX_BYTES, 7_000_000);
  assert.equal(SHARE_ENCODED_MAX_CHARS, Math.ceil(SHARE_DECOMPRESSED_MAX_BYTES * 4 / 3));
  assert.equal(SHARE_ENCODED_MAX_CHARS, 9_333_334);
});

test("decodeShareEnvelope rejects encoded length past the share-token maximum before base64 work", async () => {
  const boundary = await decodeShareEnvelope("A".repeat(SHARE_ENCODED_MAX_CHARS));
  assert.notDeepEqual(
    boundary,
    { ok: false, error: "share token exceeds the encoded size limit" },
    "exact boundary must not be classified oversized",
  );

  const crossing = await decodeShareEnvelope("A".repeat(SHARE_ENCODED_MAX_CHARS + 1));
  assert.deepEqual(
    crossing,
    { ok: false, error: "share token exceeds the encoded size limit" },
    "first crossing must be classified oversized",
  );
});

test("encodeShareEnvelope rejects invalid in-memory documents before emitting a token", async () => {
  const invalid = {
    ...sample,
    source: { ...sample.source, text: "x".repeat(SCENE_LIMITS.source + 1) },
  };
  await assert.rejects(
    () => encodeShareEnvelope(buildShareEnvelope(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "source.text exceeds the size limit");
      return true;
    },
  );
});

test("encodeShareEnvelope rejects a valid-schema envelope whose JSON exceeds the decompressed cap", async () => {
  const oversized = { ...sample, title: "x".repeat(7_000_000) };
  await assert.rejects(
    () => encodeShareEnvelope(buildShareEnvelope(oversized)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "share payload exceeds the decompressed size limit");
      return true;
    },
  );
});

test("encodeShareEnvelope enforces the encoded token cap at its exact boundary", async () => {
  const originalCompressionStream = Object.getOwnPropertyDescriptor(globalThis, "CompressionStream");
  let compressedSize = SHARE_DECOMPRESSED_MAX_BYTES;
  class ControlledCompressionStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    constructor() {
      const stream = new TransformStream<Uint8Array, Uint8Array>({
        transform() {},
        flush(controller) {
          controller.enqueue(new Uint8Array(compressedSize));
        },
      });
      this.readable = stream.readable;
      this.writable = stream.writable;
    }
  }
  Object.defineProperty(globalThis, "CompressionStream", {
    configurable: true,
    value: ControlledCompressionStream,
  });

  try {
    const boundary = await encodeShareEnvelope(buildShareEnvelope(sample));
    assert.equal(boundary.length, SHARE_ENCODED_MAX_CHARS);

    compressedSize += 1;
    await assert.rejects(
      () => encodeShareEnvelope(buildShareEnvelope(sample)),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "share token exceeds the encoded size limit");
        return true;
      },
    );
  } finally {
    if (originalCompressionStream) {
      Object.defineProperty(globalThis, "CompressionStream", originalCompressionStream);
    } else {
      Reflect.deleteProperty(globalThis, "CompressionStream");
    }
  }
});

test("decodeShareEnvelope rejects malformed UTF-8 inside otherwise valid JSON", async () => {
  const marker = "UTF8MARK";
  const json = JSON.stringify({ v: SHARE_ENVELOPE_VERSION, document: { ...sample, title: marker } });
  const [prefix, suffix] = json.split(marker);
  const encoder = new TextEncoder();
  const left = encoder.encode(prefix);
  const right = encoder.encode(suffix);
  const malformed = new Uint8Array(left.length + 2 + right.length);
  malformed.set(left);
  malformed.set([0xc3, 0x28], left.length);
  malformed.set(right, left.length + 2);

  const compressed = new Uint8Array(
    await new Response(
      new Blob([malformed]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  const result = await decodeShareEnvelope(bytesToBase64Url(compressed));
  assert.equal(result.ok, false, "malformed UTF-8 must fail closed");
});

test("decompressed size-limit classification survives reader.cancel rejection", async () => {
  const originalCancel = ReadableStreamDefaultReader.prototype.cancel;
  ReadableStreamDefaultReader.prototype.cancel = async () => {
    throw new Error("cancel failed");
  };
  try {
    const oversizedJson = JSON.stringify({
      v: SHARE_ENVELOPE_VERSION,
      document: {
        ...sample,
        source: { ...sample.source, text: "x".repeat(SCENE_LIMITS.source * 7) },
      },
    });
    const compressed = new Uint8Array(await new Response(
      new Blob([new TextEncoder().encode(oversizedJson)])
        .stream()
        .pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer());
    assert.deepEqual(
      await decodeShareEnvelope(bytesToBase64Url(compressed)),
      { ok: false, error: "share payload exceeds the decompressed size limit" },
    );
  } finally {
    ReadableStreamDefaultReader.prototype.cancel = originalCancel;
  }
});
