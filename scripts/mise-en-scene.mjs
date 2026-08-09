#!/usr/bin/env node
/**
 * Headless export CLI entry.
 *
 * Bundles src/cli/main.ts (and the React SSR export path) with esbuild, then
 * runs the bundle. Same approach as the exports test harness: JSX cannot run
 * under node --experimental-strip-types alone.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "src/cli/main.ts");
const esbuildBin = join(root, "node_modules/.bin/esbuild");
const cacheDir = join(root, "node_modules/.cache/mise-en-scene");
const bundlePath = join(cacheDir, "cli.cjs");
const stampPath = join(cacheDir, "cli.stamp");

function fingerprint() {
  const hash = createHash("sha256");
  hash.update(readFileSync(entry));
  hash.update(String(statSync(join(root, "src/scene/exports.tsx")).mtimeMs));
  hash.update(String(statSync(join(root, "src/components/SceneSvg.tsx")).mtimeMs));
  hash.update(String(statSync(join(root, "package.json")).mtimeMs));
  return hash.digest("hex");
}

function ensureBundle() {
  if (!existsSync(esbuildBin)) {
    console.error("mise-en-scene: esbuild is missing; run npm install");
    process.exit(1);
  }
  mkdirSync(cacheDir, { recursive: true });
  const stamp = fingerprint();
  if (existsSync(bundlePath) && existsSync(stampPath) && readFileSync(stampPath, "utf8") === stamp) {
    return;
  }
  const result = spawnSync(
    esbuildBin,
    [
      entry,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--jsx=automatic",
      `--outfile=${bundlePath}`,
      "--log-level=warning",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NODE_PATH: join(root, "node_modules") },
    },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "esbuild failed");
    process.exit(1);
  }
  writeFileSync(stampPath, stamp);
}

ensureBundle();

const { main } = await import(pathToFileURL(bundlePath).href);
const code = main(process.argv.slice(2));
process.exit(code ?? 0);
