import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createCachedForeignObjectRasterCheck,
  foreignObjectProbeSvg,
  foreignObjectRasterNotice,
  preparePdfRasterExport,
  preparePngRasterExport,
  prepareVideoRasterExport,
  probeForeignObjectRaster,
  type ForeignObjectRasterDeps,
  type ProbeCanvas,
  type ProbeCanvasContext,
} from "./foreignObjectRaster.ts";
import { SCENE_HEIGHT, SCENE_WIDTH } from "./raster.ts";

const FO_R = 255;
const FO_G = 0;
const FO_B = 170;
const BG_R = 1;
const BG_G = 2;
const BG_B = 3;

function pixelData(r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

function makeDeps(opts: {
  pixel?: Uint8ClampedArray;
  context?: ProbeCanvasContext | null;
  loadError?: Error;
  drawError?: Error;
  readError?: Error;
  onLoad?: () => void;
}): ForeignObjectRasterDeps {
  const pixel = opts.pixel ?? pixelData(FO_R, FO_G, FO_B);
  return {
    loadImage: async (src: string) => {
      assert.match(src, /^data:image\/svg\+xml/);
      opts.onLoad?.();
      if (opts.loadError) throw opts.loadError;
      return { src };
    },
    createCanvas: (width: number, height: number): ProbeCanvas => {
      assert.ok(width > 0 && height > 0);
      const ctx: ProbeCanvasContext | null =
        opts.context === null
          ? null
          : opts.context ?? {
              drawImage() {
                if (opts.drawError) throw opts.drawError;
              },
              getImageData() {
                if (opts.readError) throw opts.readError;
                return { data: pixel };
              },
            };
      return {
        width,
        height,
        getContext(type: "2d") {
          assert.equal(type, "2d");
          return ctx;
        },
      };
    },
  };
}

test("foreignObjectProbeSvg is explicitly sized with control background and XHTML foreignObject fill", () => {
  const svg = foreignObjectProbeSvg();
  assert.match(svg, /^<svg[^>]*\bwidth="\d+"[^>]*\bheight="\d+"/);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<rect\b[^>]*fill="#010203"/i);
  assert.match(svg, /<foreignObject\b/);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(svg, /#ff00aa/i);
  assert.doesNotMatch(svg, /url\(/i);
  assert.doesNotMatch(svg, /<image\b/i);
});

test("probe reports supported when foreignObject pixel color is present", async () => {
  assert.equal(await probeForeignObjectRaster(makeDeps({ pixel: pixelData(FO_R, FO_G, FO_B) })), true);
});

test("probe reports unsupported when only the control background is drawn", async () => {
  assert.equal(await probeForeignObjectRaster(makeDeps({ pixel: pixelData(BG_R, BG_G, BG_B) })), false);
});

test("probe reports unsupported when the 2D context is missing", async () => {
  assert.equal(await probeForeignObjectRaster(makeDeps({ context: null })), false);
});

test("probe reports unsupported when image load fails", async () => {
  assert.equal(await probeForeignObjectRaster(makeDeps({ loadError: new Error("scene could not be rasterized") })), false);
});

test("probe reports unsupported when draw or pixel read throws", async () => {
  assert.equal(await probeForeignObjectRaster(makeDeps({ drawError: new Error("draw failed") })), false);
  assert.equal(await probeForeignObjectRaster(makeDeps({ readError: new DOMException("tainted", "SecurityError") })), false);
});

test("cached probe runs the raster check once", async () => {
  let loads = 0;
  const check = createCachedForeignObjectRasterCheck(
    makeDeps({
      onLoad: () => {
        loads += 1;
      },
    }),
  );
  assert.equal(await check(), true);
  assert.equal(await check(), true);
  assert.equal(loads, 1);
});

test("PNG guard returns unsupported notice when the probe fails", async () => {
  let probed = 0;
  const result = await preparePngRasterExport({
    canRasterize: async () => {
      probed += 1;
      return false;
    },
  });
  assert.equal(probed, 1);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.notice, /PNG/i);
    assert.match(result.notice, /foreignObject/i);
    assert.match(result.notice, /SVG or HTML/i);
  }
});

test("PNG guard returns ok when the probe succeeds", async () => {
  const result = await preparePngRasterExport({ canRasterize: async () => true });
  assert.deepEqual(result, { ok: true });
});

test("PDF guard returns unsupported notice when the probe fails", async () => {
  let probed = 0;
  const result = await preparePdfRasterExport({
    canRasterize: async () => {
      probed += 1;
      return false;
    },
  });
  assert.equal(probed, 1);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.notice, /PDF/i);
    assert.match(result.notice, /foreignObject/i);
    assert.match(result.notice, /SVG or HTML/i);
  }
});

test("PDF guard returns ok when the probe succeeds", async () => {
  const result = await preparePdfRasterExport({ canRasterize: async () => true });
  assert.deepEqual(result, { ok: true });
});

test("video guard keeps MediaRecorder precheck before the foreignObject probe", async () => {
  let probed = 0;
  const mediaBlocked = await prepareVideoRasterExport({
    mediaSupported: false,
    canRasterize: async () => {
      probed += 1;
      return true;
    },
  });
  assert.equal(mediaBlocked.ok, false);
  if (!mediaBlocked.ok) assert.match(mediaBlocked.notice, /Video recording is not supported/i);
  assert.equal(probed, 0);

  const foBlocked = await prepareVideoRasterExport({
    mediaSupported: true,
    canRasterize: async () => {
      probed += 1;
      return false;
    },
  });
  assert.equal(foBlocked.ok, false);
  if (!foBlocked.ok) {
    assert.match(foBlocked.notice, /video|recording/i);
    assert.match(foBlocked.notice, /foreignObject/i);
    assert.match(foBlocked.notice, /SVG or HTML/i);
  }
  assert.equal(probed, 1);
});

test("video guard returns ok when media and foreignObject checks pass", async () => {
  const result = await prepareVideoRasterExport({
    mediaSupported: true,
    canRasterize: async () => true,
  });
  assert.deepEqual(result, { ok: true });
});

test("format-specific notices stay distinct and actionable", () => {
  const png = foreignObjectRasterNotice("png");
  const pdf = foreignObjectRasterNotice("pdf");
  const video = foreignObjectRasterNotice("video");
  assert.notEqual(png, pdf);
  assert.notEqual(png, video);
  assert.notEqual(pdf, video);
  assert.match(png, /PNG/);
  assert.match(pdf, /PDF/);
  assert.match(video, /video|recording/i);
  assert.match(png, /SVG or HTML/);
  assert.match(pdf, /SVG or HTML/);
  assert.match(video, /SVG or HTML/);
});

test("probe SVG stays far smaller than a scene export canvas", () => {
  const svg = foreignObjectProbeSvg();
  const width = Number(/width="(\d+)"/.exec(svg)?.[1]);
  const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
  assert.ok(width > 0 && width < SCENE_WIDTH);
  assert.ok(height > 0 && height < SCENE_HEIGHT);
});

test("App wires raster export guards including PDF", () => {
  const app = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
  assert.match(app, /from\s+["']\.\/scene\/foreignObjectRaster["']/);
  assert.match(app, /\bpreparePngRasterExport\b/);
  assert.match(app, /\bpreparePdfRasterExport\b/);
  assert.match(app, /\bprepareVideoRasterExport\b/);
  assert.match(app, /\bmediaSupported\b/);
  assert.match(app, /\bpdfFromJpeg\b/);
  assert.match(app, /\bpdfBlob\b/);
  assert.match(app, /Export PDF/);
});
