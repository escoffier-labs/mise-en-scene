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
  SHARE_ENVELOPE_VERSION,
} from "./share.ts";

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
