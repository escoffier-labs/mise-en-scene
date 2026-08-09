import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG_SCALE, SCENE_HEIGHT, SCENE_WIDTH, sizedSvg } from "../scene/raster.ts";
import { findChromePath } from "./chrome.ts";

export type RasterPngDeps = {
  findChrome?: (explicit?: string) => string | null;
  runChrome?: (chromePath: string, args: string[]) => SpawnSyncReturns<Buffer>;
  mkTempDir?: () => string;
  writeFile?: (path: string, data: string | Buffer) => void;
  readFile?: (path: string) => Buffer;
  removeDir?: (path: string) => void;
};

export type RasterPngResult = { ok: true; png: Buffer } | { ok: false; error: string };

export function rasterSvgToPng(
  svg: string,
  opts: { chromePath?: string; scale?: number; width?: number; height?: number } = {},
  deps: RasterPngDeps = {},
): RasterPngResult {
  const findChrome = deps.findChrome ?? ((explicit?: string) => findChromePath(explicit));
  const chromePath = findChrome(opts.chromePath);
  if (!chromePath) {
    return {
      ok: false,
      error:
        "PNG export needs a Chromium browser. Set CHROME_PATH or pass --chrome-path, or install Google Chrome / Chromium.",
    };
  }

  const width = opts.width ?? SCENE_WIDTH;
  const height = opts.height ?? SCENE_HEIGHT;
  const scale = opts.scale ?? PNG_SCALE;
  const sized = sizedSvg(svg, width, height);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#0d1014;overflow:hidden}svg{display:block}</style></head><body>${sized}</body></html>`;

  const mkTempDir = deps.mkTempDir ?? (() => mkdtempSync(join(tmpdir(), "mise-en-scene-png-")));
  const writeFile = deps.writeFile ?? ((path, data) => writeFileSync(path, data));
  const readFile = deps.readFile ?? ((path) => readFileSync(path));
  const removeDir = deps.removeDir ?? ((path) => rmSync(path, { recursive: true, force: true }));
  const runChrome =
    deps.runChrome ??
    ((bin, args) =>
      spawnSync(bin, args, {
        encoding: "buffer",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 60_000,
      }));

  const dir = mkTempDir();
  const htmlPath = join(dir, "scene.html");
  const pngPath = join(dir, "scene.png");
  try {
    writeFile(htmlPath, html);
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ];
    const proc = runChrome(chromePath, args);
    if (proc.error) {
      return { ok: false, error: `failed to launch Chromium: ${proc.error.message}` };
    }
    if (proc.status !== 0) {
      const stderr = bufferText(proc.stderr);
      return { ok: false, error: `Chromium exited with status ${proc.status}${stderr ? `: ${stderr.slice(0, 400)}` : ""}` };
    }
    let png: Buffer;
    try {
      png = readFile(pngPath);
    } catch {
      return { ok: false, error: "Chromium did not write a PNG screenshot" };
    }
    if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50) {
      return { ok: false, error: "Chromium screenshot was not a PNG" };
    }
    return { ok: true, png };
  } finally {
    removeDir(dir);
  }
}

function bufferText(value: Buffer | string | null | undefined): string {
  if (!value) return "";
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}
