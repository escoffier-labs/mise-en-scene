// Print-styled single-page PDF from a JPEG raster of the scene.
//
// Reuses the same standalone SVG → canvas path as PNG export. The pure part
// wraps JPEG bytes in a minimal PDF with a landscape page sized to the scene
// aspect ratio and half-inch margins, so the artifact drops into reports
// without a print dialog. Canvas JPEG encoding stays in the browser (App.tsx).

import { SCENE_HEIGHT, SCENE_WIDTH } from "./raster.ts";

export const PDF_MARGIN_PT = 36; // half inch at 72 pt/in
export const PDF_CONTENT_WIDTH_PT = 720; // 10 inches of figure width

export type PdfPageLayout = {
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
  margin: number;
};

export function pdfPageSize(
  contentWidth = PDF_CONTENT_WIDTH_PT,
  margin = PDF_MARGIN_PT,
): PdfPageLayout {
  const contentHeight = contentWidth * (SCENE_HEIGHT / SCENE_WIDTH);
  return {
    pageWidth: contentWidth + 2 * margin,
    pageHeight: contentHeight + 2 * margin,
    contentWidth,
    contentHeight,
    margin,
  };
}

function encoder() {
  return new TextEncoder();
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

// Build a PDF 1.4 document with one page and one DCTDecode image XObject.
// Offsets are computed after serializing so the xref table stays exact.
export function pdfFromJpeg(
  jpeg: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  opts: { contentWidth?: number; margin?: number } = {},
): Uint8Array {
  if (jpeg.length === 0) throw new Error("JPEG payload is empty");
  if (imageWidth <= 0 || imageHeight <= 0) throw new Error("image dimensions must be positive");

  const layout = pdfPageSize(opts.contentWidth, opts.margin);
  const { pageWidth, pageHeight, contentWidth, contentHeight, margin } = layout;
  const enc = encoder();

  const contentStream = [
    "q",
    `${num(contentWidth)} 0 0 ${num(contentHeight)} ${num(margin)} ${num(margin)} cm`,
    "/Im1 Do",
    "Q",
  ].join("\n");
  const contentBytes = enc.encode(contentStream);

  const objects: Uint8Array[] = [];
  const pushObj = (body: Uint8Array) => {
    objects.push(body);
  };

  pushObj(enc.encode("<< /Type /Catalog /Pages 2 0 R >>"));
  pushObj(enc.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  pushObj(
    enc.encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageWidth)} ${num(pageHeight)}] ` +
        `/Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>`,
    ),
  );
  pushObj(
    concatBytes([
      enc.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      enc.encode("\nendstream"),
    ]),
  );
  pushObj(
    concatBytes([
      enc.encode(
        `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      enc.encode("\nendstream"),
    ]),
  );

  const parts: Uint8Array[] = [enc.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets: number[] = [0];
  let offset = parts[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const header = enc.encode(`${i + 1} 0 obj\n`);
    const footer = enc.encode("\nendobj\n");
    parts.push(header, objects[i], footer);
    offset += header.length + objects[i].length + footer.length;
  }

  const xrefStart = offset;
  const xrefLines = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(enc.encode(xrefLines.join("")));
  parts.push(
    enc.encode(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
    ),
  );
  return concatBytes(parts);
}
