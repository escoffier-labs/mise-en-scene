import assert from "node:assert/strict";
import test from "node:test";
import { PNG_SCALE, SCENE_HEIGHT, SCENE_WIDTH } from "./raster.ts";
import { PDF_CONTENT_WIDTH_PT, PDF_MARGIN_PT, pdfBlob, pdfFromJpeg, pdfPageSize } from "./pdf.ts";

// Minimal valid JPEG (1x1 pixel) so the PDF embeds a real DCTDecode payload.
const TINY_JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14,
  0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
]);

function asText(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

test("pdfPageSize builds a landscape page around the scene aspect with margins", () => {
  const layout = pdfPageSize();
  assert.equal(layout.margin, PDF_MARGIN_PT);
  assert.equal(layout.contentWidth, PDF_CONTENT_WIDTH_PT);
  assert.equal(layout.contentHeight, PDF_CONTENT_WIDTH_PT * (SCENE_HEIGHT / SCENE_WIDTH));
  assert.equal(layout.pageWidth, layout.contentWidth + 2 * layout.margin);
  assert.equal(layout.pageHeight, layout.contentHeight + 2 * layout.margin);
  assert.ok(layout.pageWidth > layout.pageHeight);
});

test("pdfFromJpeg emits a single-page PDF with the JPEG image XObject", () => {
  const width = SCENE_WIDTH * PNG_SCALE;
  const height = SCENE_HEIGHT * PNG_SCALE;
  const pdf = pdfFromJpeg(TINY_JPEG, width, height);
  const text = asText(pdf);

  assert.match(text, /^%PDF-1\.4\n/);
  assert.match(text, /%%EOF\n$/);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Type \/Pages \/Kids \[3 0 R\] \/Count 1/);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, new RegExp(`/Width ${width}`));
  assert.match(text, new RegExp(`/Height ${height}`));
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/Im1 Do/);
  assert.match(text, /startxref\n\d+\n%%EOF\n$/);

  const layout = pdfPageSize();
  assert.match(text, new RegExp(`/MediaBox \\[0 0 ${layout.pageWidth} ${layout.pageHeight}\\]`));
  assert.match(text, new RegExp(`${layout.contentWidth} 0 0 ${layout.contentHeight} ${layout.margin} ${layout.margin} cm`));

  // JPEG payload survives binary embedding (SOI marker intact).
  const soi = pdf.indexOf(0xff);
  assert.ok(soi > 0);
  assert.equal(pdf[soi], 0xff);
  assert.equal(pdf[soi + 1], 0xd8);
});

test("pdfFromJpeg rejects empty or invalid image inputs", () => {
  assert.throws(() => pdfFromJpeg(new Uint8Array(), 10, 10), /empty/i);
  assert.throws(() => pdfFromJpeg(TINY_JPEG, 0, 10), /positive/i);
  assert.throws(() => pdfFromJpeg(TINY_JPEG, 10, -1), /positive/i);
});

test("pdfFromJpeg xref offsets point at object headers", () => {
  const pdf = pdfFromJpeg(TINY_JPEG, 8, 8);
  const text = asText(pdf);
  const xrefMatch = /xref\n0 6\n([\s\S]*?)trailer/.exec(text);
  assert.ok(xrefMatch);
  const rows = xrefMatch![1].trimEnd().split("\n");
  assert.equal(rows.length, 6);
  assert.match(rows[0], /^0000000000 65535 f $/);
  for (let i = 1; i <= 5; i++) {
    const offset = Number(rows[i].slice(0, 10));
    const slice = asText(pdf.subarray(offset, offset + 16));
    assert.match(slice, new RegExp(`^${i} 0 obj\\n`));
  }
});

test("pdfBlob wraps bytes as application/pdf", async () => {
  const pdf = pdfFromJpeg(TINY_JPEG, 8, 8);
  const blob = pdfBlob(pdf);
  assert.equal(blob.type, "application/pdf");
  assert.equal(blob.size, pdf.byteLength);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), pdf);
});
