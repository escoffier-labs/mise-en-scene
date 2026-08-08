import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractScene } from "./extract.ts";
import { htmlDocument, svgDocument } from "./exportText.ts";
import { layoutScene } from "./layout.ts";
import { stepCamera, walkthroughSteps } from "./walkthrough.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../");
const esbuildBin = join(repoRoot, "node_modules/.bin/esbuild");

const representativeSource = "Browser -> API: sends request\nAPI -> Database: reads rows";
const representativeScene = extractScene(representativeSource, "engineer").document;

type HarnessResult = {
  output: string;
  architectureMarkup?: string;
  sequenceMarkup?: string;
  sceneSvgMarkup?: string;
  walkSceneMarkup?: string;
};

function runExportsHarness(
  op: "html" | "svg" | "walk",
  scene: unknown,
  extra: Record<string, unknown> = {},
): HarnessResult {
  const dir = mkdtempSync(join(tmpdir(), "mise-exports-harness-"));
  try {
    const harnessPath = join(dir, "harness.ts");
    const bundlePath = join(dir, "harness.cjs");
    const sceneSvgModule = JSON.stringify(join(repoRoot, "src/components/SceneSvg.tsx"));
    const exportsModule = JSON.stringify(join(repoRoot, "src/scene/exports.tsx"));
    const layoutModule = JSON.stringify(join(repoRoot, "src/scene/layout.ts"));
    writeFileSync(
      harnessPath,
      `import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneSvg } from ${sceneSvgModule};
import { standaloneHtml, standaloneSvg, standaloneWalkthrough } from ${exportsModule};
import { layoutScene } from ${layoutModule};

const payload = JSON.parse(process.argv[2]);
const scene = payload.scene;
const architecture = layoutScene(scene, "architecture");
const sequence = layoutScene(scene, "sequence");
const sceneSvg = (sceneDoc: unknown, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(SceneSvg, { scene: sceneDoc, ...props }));

let output = "";
let architectureMarkup = "";
let sequenceMarkup = "";
let sceneSvgMarkup = "";
let walkSceneMarkup = "";

if (payload.op === "html") {
  output = standaloneHtml(scene);
  architectureMarkup = sceneSvg(architecture);
  sequenceMarkup = sceneSvg(sequence);
} else if (payload.op === "svg") {
  const laid = architecture;
  const review = payload.review ?? false;
  const spotlight = payload.spotlight ?? null;
  const camera = payload.camera;
  output = standaloneSvg(laid, review, spotlight, camera);
  sceneSvgMarkup = sceneSvg(laid, { review, spotlight, camera });
} else {
  output = standaloneWalkthrough(scene);
  walkSceneMarkup = sceneSvg(architecture, { camera: "translate(0 0) scale(1)" });
}

console.log(JSON.stringify({ output, architectureMarkup, sequenceMarkup, sceneSvgMarkup, walkSceneMarkup }));
`,
    );

    const bundle = spawnSync(
      esbuildBin,
      [
        harnessPath,
        "--bundle",
        "--platform=node",
        "--format=cjs",
        "--jsx=automatic",
        `--outfile=${bundlePath}`,
      ],
      { cwd: repoRoot, encoding: "utf8", timeout: 120000, env: { ...process.env, NODE_PATH: join(repoRoot, "node_modules") } },
    );
    if (bundle.status !== 0) {
      throw new Error(bundle.stderr || bundle.stdout || "esbuild bundle failed");
    }

    const proc = spawnSync(process.execPath, [bundlePath, JSON.stringify({ op, scene, ...extra })], {
      cwd: dir,
      encoding: "utf8",
      timeout: 120000,
    });
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || `harness failed for ${op}`);
    }
    return JSON.parse(proc.stdout.trim()) as HarnessResult;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function normalizeSvgDocument(markup: string) {
  return markup.replace(/^<svg/, "<svg xmlns=\"http://www.w3.org/2000/svg\"").replace(/<script[\s\S]*?<\/script>/gi, "");
}

function parseWalkSteps(html: string) {
  const match = html.match(/<script type="application\/json" id="walk-steps">([\s\S]*?)<\/script>/);
  assert.ok(match, "walkthrough must embed serialized steps");
  return JSON.parse(match[1]) as Array<{ caption: string; camera: string; edgeId: string | null; blockIds: string[] }>;
}

test("HTML export embeds safe scene data and interaction hooks", () => {
  const html = htmlDocument("<svg></svg>", { schemaVersion: 1, title: "</script><b>x</b>" });
  assert.match(html, /application\/json/);
  assert.match(html, /data-view/);
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /schemaVersion/);
});

test("SVG export adds namespace and contains no script", () => {
  const svg = svgDocument("<svg viewBox=\"0 0 10 10\"><style>.x{}</style></svg>");
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<script/);
});

test("standaloneHtml assembles document shell and both SceneSvg views", () => {
  const { output: html, architectureMarkup, sequenceMarkup } = runExportsHarness("html", representativeScene);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Mise en Scene export<\/title>/);
  assert.match(html, /<button data-view="architecture">Architecture<\/button>/);
  assert.match(html, /<button data-view="sequence">Sequence<\/button>/);
  assert.match(html, /<script type="application\/json" id="scene-data">/);
  assert.match(html, /class="inspector"/);

  const archSection = html.match(/<section class="view" data-view="architecture">([\s\S]*?)<\/section>/)?.[1];
  const seqSection = html.match(/<section class="view" data-view="sequence">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(archSection, "architecture view section is present");
  assert.ok(seqSection, "sequence view section is present");
  assert.equal(archSection, architectureMarkup);
  assert.equal(seqSection, sequenceMarkup);
  assert.match(archSection, /aria-label="Browser -&gt; API: sends request architecture scene"/);
  assert.match(seqSection, /aria-label="Browser -&gt; API: sends request sequence scene"/);
  assert.match(archSection, /<path d="M[^"]* C /);
  assert.match(seqSection, /class="lifeline"/);
  assert.match(archSection, /data-block-id="/);
  assert.match(archSection, /sends request/);
});

test("standaloneHtml escapes unsafe scene title in embedded JSON", () => {
  const unsafe = { ...representativeScene, title: "</script><b>x</b>" };
  const { output: html } = runExportsHarness("html", unsafe);
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /\\u003c\/script>/);
});

test("standaloneSvg wraps SceneSvg markup in a static SVG document", () => {
  const { output: svg, sceneSvgMarkup } = runExportsHarness("svg", representativeScene);
  assert.equal(svg, normalizeSvgDocument(sceneSvgMarkup!));
  assert.match(svg, /viewBox="0 0 1280 780"/);
  assert.match(svg, /class="scene-title"/);
  assert.match(svg, /data-edge-id="/);
  assert.match(svg, /reads rows/);
  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /class="lifeline"/);
});

test("standaloneSvg forwards review, spotlight, and camera to SceneSvg", () => {
  const laid = layoutScene(representativeScene, "architecture");
  const edge = laid.edges[0];
  const spotlight = { blockIds: [edge.from, edge.to], edgeId: edge.id };
  const camera = "translate(12 24) scale(1.4)";
  const { output: svg, sceneSvgMarkup } = runExportsHarness("svg", representativeScene, { review: true, spotlight, camera });

  assert.equal(svg, normalizeSvgDocument(sceneSvgMarkup!));
  assert.match(svg, /class="stage-camera"/);
  assert.match(svg, /transform="translate\(12 24\) scale\(1.4\)"/);
  assert.match(svg, /walk-on|walk-dim/);
  assert.match(svg, /ungrounded/);
});

test("standaloneWalkthrough embeds SceneSvg, controls, and serialized camera steps", () => {
  const { output: html, walkSceneMarkup } = runExportsHarness("walk", representativeScene);
  const laid = layoutScene(representativeScene, "architecture");

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<title>Mise en Scene walkthrough<\/title>/);
  assert.match(html, /class="walk-stage"/);
  assert.match(html, /id="walk-play"/);
  assert.match(html, /id="walk-prev"/);
  assert.match(html, /id="walk-next"/);
  assert.match(html, /id="walk-caption"/);
  assert.match(html, /id="walk-counter"/);
  assert.match(html, /id="walk-fill"/);

  const embeddedScene = html.match(/<div class="walk-stage">([\s\S]*?)<div class="walk-title"/)?.[1];
  assert.ok(embeddedScene, "walkthrough must embed rendered scene markup");
  assert.equal(embeddedScene!.trim(), walkSceneMarkup);

  const steps = parseWalkSteps(html);
  const expected = walkthroughSteps(laid).map((step) => ({ ...step, camera: stepCamera(laid, step) }));
  assert.deepEqual(steps, expected);
  assert.equal(steps[0].edgeId, null);
  assert.match(steps[0].caption, /Browser -> API: sends request/);
  assert.match(steps[1].camera, /translate\(/);
  assert.match(steps[1].caption, /sends request/);
});

test("standaloneWalkthrough escapes unsafe captions in serialized steps", () => {
  const unsafe = {
    ...representativeScene,
    edges: representativeScene.edges.map((edge, index) =>
      index === 0 ? { ...edge, label: "<img onerror=alert(1)>" } : edge,
    ),
  };
  const { output: html } = runExportsHarness("walk", unsafe);
  assert.doesNotMatch(html, /<img onerror/);
  const steps = parseWalkSteps(html);
  assert.ok(steps.some((step) => step.caption.includes("<img onerror=alert(1)>")));
});
