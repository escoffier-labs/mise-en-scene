import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractScene } from "../scene/extract.ts";
import { layoutScene } from "../scene/layout.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../");
const esbuildBin = join(repoRoot, "node_modules/.bin/esbuild");
const scene = extractScene("Browser -> API: sends request\nAPI -> Database: reads rows", "engineer").document;

type KeyProbe = { selects: Array<[string, string]>; prevented: boolean };
type EdgeKeyResult = {
  edgeId: string;
  Enter: KeyProbe;
  Space: KeyProbe;
  Escape: KeyProbe;
};
type ViewProbe = { markup: string; edges: EdgeKeyResult[] };

function probeView(view: "architecture" | "sequence"): ViewProbe {
  const dir = mkdtempSync(join(tmpdir(), "mise-edge-a11y-"));
  try {
    const harnessPath = join(dir, "harness.ts");
    const bundlePath = join(dir, "harness.cjs");
    const sceneSvgModule = JSON.stringify(join(repoRoot, "src/components/SceneSvg.tsx"));
    const layoutModule = JSON.stringify(join(repoRoot, "src/scene/layout.ts"));
    writeFileSync(
      harnessPath,
      `import { createElement, Fragment, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneSvg } from ${sceneSvgModule};
import { layoutScene } from ${layoutModule};

function walk(node, visit) {
  if (node == null || typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isValidElement(node)) return;
  const type = node.type;
  if (typeof type === "function") {
    walk(type(node.props), visit);
    return;
  }
  if (type === Fragment) {
    walk(node.props.children, visit);
    return;
  }
  visit(node);
  walk(node.props?.children, visit);
}

function keyEvent(key) {
  let prevented = false;
  return {
    key,
    preventDefault() { prevented = true; },
    wasPrevented() { return prevented; },
  };
}

function probeKey(onKeyDown, key, selects) {
  selects.length = 0;
  const event = keyEvent(key);
  onKeyDown(event);
  return { selects: selects.slice(), prevented: event.wasPrevented() };
}

const payload = JSON.parse(process.argv[2]);
const laid = layoutScene(payload.scene, payload.view);
const selects = [];
const root = createElement(SceneSvg, {
  scene: laid,
  onSelect: (type, id) => selects.push([type, id]),
});
const edgeEls = [];
walk(root, (el) => {
  const id = el.props?.["data-edge-id"];
  if (el.type === "g" && typeof id === "string" && typeof el.props.onKeyDown === "function") {
    edgeEls.push({ id, onKeyDown: el.props.onKeyDown });
  }
});
const edges = edgeEls.map((edge) => ({
  edgeId: edge.id,
  Enter: probeKey(edge.onKeyDown, "Enter", selects),
  Space: probeKey(edge.onKeyDown, " ", selects),
  Escape: probeKey(edge.onKeyDown, "Escape", selects),
}));
const markup = renderToStaticMarkup(createElement(SceneSvg, { scene: laid }));
process.stdout.write(JSON.stringify({ markup, edges }));
`,
    );
    const bundle = spawnSync(
      esbuildBin,
      [harnessPath, "--bundle", "--platform=node", "--format=cjs", "--jsx=automatic", `--outfile=${bundlePath}`],
      { cwd: repoRoot, encoding: "utf8", timeout: 120000, env: { ...process.env, NODE_PATH: join(repoRoot, "node_modules") } },
    );
    if (bundle.status !== 0) throw new Error(bundle.stderr || bundle.stdout || "esbuild bundle failed");
    const proc = spawnSync(process.execPath, [bundlePath, JSON.stringify({ scene, view })], {
      cwd: dir,
      encoding: "utf8",
      timeout: 120000,
    });
    if (proc.status !== 0) throw new Error(proc.stderr || proc.stdout || `probe failed for ${view}`);
    return JSON.parse(proc.stdout) as ViewProbe;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function edgeGroups(markup: string): string[] {
  return [...markup.matchAll(/<g[^>]*data-edge-id="[^"]*"[^>]*>/g)].map((m) => m[0]);
}

function assertEdgeKeyboardAffordance(markup: string, view: string) {
  const edges = edgeGroups(markup);
  assert.ok(edges.length > 0, `${view} must render edges`);
  for (const group of edges) {
    assert.match(group, /role="button"/, `${view} edge must be role=button: ${group}`);
    assert.match(group, /tabindex="0"/i, `${view} edge must be tabIndex=0: ${group}`);
  }
}

function assertEdgeKeyActivation(probe: ViewProbe, view: "architecture" | "sequence") {
  const laid = layoutScene(scene, view);
  assert.equal(probe.edges.length, laid.edges.length, `${view} must probe every edge`);
  const byId = new Map(probe.edges.map((edge) => [edge.edgeId, edge]));
  for (const edge of laid.edges) {
    const result = byId.get(edge.id);
    assert.ok(result, `${view} missing key probe for ${edge.id}`);
    assert.deepEqual(result.Enter.selects, [["edge", edge.id]]);
    assert.equal(result.Enter.prevented, true);
    assert.deepEqual(result.Space.selects, [["edge", edge.id]]);
    assert.equal(result.Space.prevented, true);
    assert.deepEqual(result.Escape.selects, []);
    assert.equal(result.Escape.prevented, false);
  }
}

test("architecture edges are keyboard-focusable buttons", () => {
  const probe = probeView("architecture");
  assert.doesNotMatch(probe.markup, /class="lifeline"/);
  assertEdgeKeyboardAffordance(probe.markup, "architecture");
  const laid = layoutScene(scene, "architecture");
  for (const edge of laid.edges) {
    assert.match(probe.markup, new RegExp(`data-edge-id="${edge.id}"[^>]*tabindex="0"`, "i"));
  }
});

test("sequence edges are keyboard-focusable buttons", () => {
  const probe = probeView("sequence");
  assert.match(probe.markup, /class="lifeline"/);
  assertEdgeKeyboardAffordance(probe.markup, "sequence");
  const laid = layoutScene(scene, "sequence");
  for (const edge of laid.edges) {
    assert.match(probe.markup, new RegExp(`data-edge-id="${edge.id}"[^>]*tabindex="0"`, "i"));
  }
});

test("architecture edge onKeyDown activates Enter/Space and ignores other keys", () => {
  assertEdgeKeyActivation(probeView("architecture"), "architecture");
});

test("sequence edge onKeyDown activates Enter/Space and ignores other keys", () => {
  assertEdgeKeyActivation(probeView("sequence"), "sequence");
});
