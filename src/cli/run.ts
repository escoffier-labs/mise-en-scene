import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs, resolveFormat, usage, type CliArgs, type ExportFormat } from "./args.ts";
import { loadSceneFromPath, type LoadSceneResult } from "./loadScene.ts";
import { rasterSvgToPng, type RasterPngDeps } from "./png.ts";
import type { Audience, SceneDocument, SceneView } from "../scene/types.ts";

export type Renderers = {
  renderSvg: (scene: SceneDocument, view: SceneView, review?: boolean) => string;
  renderHtml: (scene: SceneDocument) => string;
  renderWalkthrough: (scene: SceneDocument) => string;
  renderJson: (scene: SceneDocument, view?: SceneView) => string;
};

export type RunResult =
  | { ok: true; format: ExportFormat; outputPath?: string }
  | { ok: false; error: string; exitCode: number };

export type RunDeps = Partial<Renderers> & {
  loadScene?: (path: string, audience: Audience) => LoadSceneResult;
  writeFile?: (path: string, data: string | Buffer) => void;
  writeStdout?: (data: string | Buffer) => void;
  rasterPng?: typeof rasterSvgToPng;
  pngDeps?: RasterPngDeps;
};

export function runCli(argv: string[], deps: RunDeps = {}): RunResult {
  const args = parseArgs(argv);
  if (args.error) return fail(args.error, 2);
  if (args.help) {
    (deps.writeStdout ?? defaultStdout)(usage());
    return { ok: true, format: "svg" };
  }
  if (!args.inputPath) {
    (deps.writeStdout ?? defaultStdout)(usage());
    return fail("input path is required", 2);
  }

  const formatResult = resolveFormat(args);
  if (typeof formatResult === "object") return fail(formatResult.error, 2);
  const format = formatResult;

  if (format === "png" && !args.outputPath) {
    return fail("PNG export requires -o/--output (binary cannot write to stdout here)", 2);
  }

  const renderersResult = resolveRenderers(deps);
  if (!renderersResult.ok) return fail(renderersResult.error, renderersResult.exitCode);
  const renderers = renderersResult.value;

  const load = deps.loadScene ?? loadSceneFromPath;
  const loaded = load(args.inputPath, args.audience);
  if (!loaded.ok) return fail(loaded.error, 1);

  const view: SceneView = args.view ?? loaded.scene.view ?? "architecture";
  try {
    const artifact = buildArtifact(loaded.scene, format, view, args, deps, renderers);
    if (!artifact.ok) return fail(artifact.error, artifact.exitCode);
    return writeArtifact(artifact.data, format, args.outputPath, deps);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "export failed", 1);
  }
}

function resolveRenderers(deps: RunDeps): { ok: true; value: Renderers } | { ok: false; error: string; exitCode: number } {
  const { renderSvg, renderHtml, renderWalkthrough, renderJson } = deps;
  if (!renderSvg || !renderHtml || !renderWalkthrough || !renderJson) {
    return { ok: false, error: "CLI renderers are not configured", exitCode: 1 };
  }
  return { ok: true, value: { renderSvg, renderHtml, renderWalkthrough, renderJson } };
}

type ArtifactResult =
  | { ok: true; data: string | Buffer }
  | { ok: false; error: string; exitCode: number };

function buildArtifact(
  scene: SceneDocument,
  format: ExportFormat,
  view: SceneView,
  args: CliArgs,
  deps: RunDeps,
  renderers: Renderers,
): ArtifactResult {
  const rasterPng = deps.rasterPng ?? rasterSvgToPng;

  switch (format) {
    case "svg":
      return { ok: true, data: renderers.renderSvg(scene, view, args.review) };
    case "html":
      return { ok: true, data: renderers.renderHtml({ ...scene, view }) };
    case "walkthrough":
      return { ok: true, data: renderers.renderWalkthrough(scene) };
    case "json":
      return { ok: true, data: renderers.renderJson(scene, view) };
    case "png": {
      const svg = renderers.renderSvg(scene, view, args.review);
      const png = rasterPng(svg, { chromePath: args.chromePath, scale: args.scale }, deps.pngDeps);
      if (!png.ok) return { ok: false, error: png.error, exitCode: 1 };
      return { ok: true, data: png.png };
    }
    default:
      return { ok: false, error: "unsupported format", exitCode: 2 };
  }
}

function writeArtifact(
  data: string | Buffer,
  format: ExportFormat,
  outputPath: string | undefined,
  deps: RunDeps,
): RunResult {
  if (!outputPath) {
    (deps.writeStdout ?? defaultStdout)(data);
    return { ok: true, format };
  }
  const writeFile =
    deps.writeFile ??
    ((path: string, body: string | Buffer) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body);
    });
  writeFile(outputPath, data);
  return { ok: true, format, outputPath };
}

function fail(error: string, exitCode: number): RunResult {
  return { ok: false, error, exitCode };
}

function defaultStdout(data: string | Buffer) {
  process.stdout.write(data);
}
