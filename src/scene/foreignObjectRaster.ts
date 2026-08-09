// Capability probe for SVG foreignObject rasterization.
//
// Scene cards use foreignObject + XHTML for wrapped text. PNG, PDF, and WebM
// exports draw that same SVG onto a canvas, so browsers that skip foreignObject
// content when decoding SVG-as-image produce empty cards. Checking
// SVGForeignObjectElement or sniffing the user agent is not enough; this module
// loads a tiny inline SVG with a control background and a uniquely colored
// foreignObject, draws it, and reads a pixel to see whether the foreign content
// survived.

import { svgToDataUrl } from "./raster.ts";

export const PROBE_WIDTH = 4;
export const PROBE_HEIGHT = 4;
export const PROBE_BACKGROUND = "#010203";
export const PROBE_FOREIGN_FILL = "#ff00aa";

const FO_R = 0xff;
const FO_G = 0x00;
const FO_B = 0xaa;

export type ProbeCanvasContext = {
  drawImage: (image: unknown, dx: number, dy: number, dw?: number, dh?: number) => void;
  getImageData: (sx: number, sy: number, sw: number, sh: number) => { data: ArrayLike<number> };
};

export type ProbeCanvas = {
  width: number;
  height: number;
  getContext: (type: "2d") => ProbeCanvasContext | null;
};

export type ForeignObjectRasterDeps = {
  loadImage: (src: string) => Promise<unknown>;
  createCanvas: (width: number, height: number) => ProbeCanvas;
};

export type RasterExportResult = { ok: true } | { ok: false; notice: string };

export function foreignObjectProbeSvg(
  width = PROBE_WIDTH,
  height = PROBE_HEIGHT,
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${PROBE_BACKGROUND}"/>`,
    `<foreignObject width="${width}" height="${height}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${PROBE_FOREIGN_FILL};"></div>`,
    `</foreignObject>`,
    `</svg>`,
  ].join("");
}

export function foreignObjectRasterNotice(kind: "png" | "video" | "pdf"): string {
  if (kind === "png") {
    return "This browser cannot rasterize foreignObject content for PNG export. Use SVG or HTML export instead.";
  }
  if (kind === "pdf") {
    return "This browser cannot rasterize foreignObject content for PDF export. Use SVG or HTML export instead.";
  }
  return "This browser cannot rasterize foreignObject content for video recording. Use SVG or HTML export instead.";
}

function defaultLoadImage(src: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("probe image failed to load"));
    img.src = src;
  });
}

function defaultCreateCanvas(width: number, height: number): ProbeCanvas {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as ProbeCanvas;
}

function resolveDeps(deps?: Partial<ForeignObjectRasterDeps>): ForeignObjectRasterDeps {
  return {
    loadImage: deps?.loadImage ?? defaultLoadImage,
    createCanvas: deps?.createCanvas ?? defaultCreateCanvas,
  };
}

function pixelMatchesForeignFill(data: ArrayLike<number>): boolean {
  return data[0] === FO_R && data[1] === FO_G && data[2] === FO_B;
}

export async function probeForeignObjectRaster(
  deps?: Partial<ForeignObjectRasterDeps>,
): Promise<boolean> {
  const { loadImage, createCanvas } = resolveDeps(deps);
  try {
    const img = await loadImage(svgToDataUrl(foreignObjectProbeSvg()));
    const canvas = createCanvas(PROBE_WIDTH, PROBE_HEIGHT);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, PROBE_WIDTH, PROBE_HEIGHT);
    const { data } = ctx.getImageData(1, 1, 1, 1);
    return pixelMatchesForeignFill(data);
  } catch {
    return false;
  }
}

export function createCachedForeignObjectRasterCheck(
  deps?: Partial<ForeignObjectRasterDeps>,
): () => Promise<boolean> {
  let cached: Promise<boolean> | undefined;
  return () => (cached ??= probeForeignObjectRaster(deps));
}

const canRasterizeForeignObject = createCachedForeignObjectRasterCheck();

export async function preparePngRasterExport(opts: {
  canRasterize?: () => Promise<boolean>;
} = {}): Promise<RasterExportResult> {
  const supported = await (opts.canRasterize ?? canRasterizeForeignObject)();
  if (!supported) return { ok: false, notice: foreignObjectRasterNotice("png") };
  return { ok: true };
}

export async function preparePdfRasterExport(opts: {
  canRasterize?: () => Promise<boolean>;
} = {}): Promise<RasterExportResult> {
  const supported = await (opts.canRasterize ?? canRasterizeForeignObject)();
  if (!supported) return { ok: false, notice: foreignObjectRasterNotice("pdf") };
  return { ok: true };
}

export async function prepareVideoRasterExport(opts: {
  mediaSupported: boolean;
  canRasterize?: () => Promise<boolean>;
}): Promise<RasterExportResult> {
  if (!opts.mediaSupported) {
    return { ok: false, notice: "Video recording is not supported in this browser" };
  }
  const supported = await (opts.canRasterize ?? canRasterizeForeignObject)();
  if (!supported) return { ok: false, notice: foreignObjectRasterNotice("video") };
  return { ok: true };
}
