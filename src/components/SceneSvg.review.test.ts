import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractScene } from "../scene/extract.ts";
import { layoutScene } from "../scene/layout.ts";
import { validateSceneDocument } from "../scene/validate.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../");
const esbuildBin = join(repoRoot, "node_modules/.bin/esbuild");

function annotatedScene() {
  const base = extractScene("Browser -> API: sends request\nAPI -> Database: reads rows", "engineer").document;
  const laid = layoutScene(base, "architecture");
  const withMarks = {
    ...laid,
    edges: laid.edges.map((edge, index) =>
      index === 0
        ? { ...edge, confidence: "high" as const, competingHypothesis: true }
        : { ...edge, confidence: "low" as const },
    ),
    blocks: laid.blocks.map((block, index) =>
      index === 0 ? { ...block, confidence: "medium" as const, competingHypothesis: true } : block,
    ),
  };
  const result = validateSceneDocument(withMarks);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function renderScene(scene: unknown, review: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "mise-review-marks-"));
  try {
    const harnessPath = join(dir, "harness.ts");
    const bundlePath = join(dir, "harness.cjs");
    const sceneSvgModule = JSON.stringify(join(repoRoot, "src/components/SceneSvg.tsx"));
    writeFileSync(
      harnessPath,
      `import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneSvg } from ${sceneSvgModule};
const payload = JSON.parse(process.argv[2]);
process.stdout.write(renderToStaticMarkup(createElement(SceneSvg, { scene: payload.scene, review: payload.review })));
`,
    );
    const bundle = spawnSync(
      esbuildBin,
      [harnessPath, "--bundle", "--platform=node", "--format=cjs", "--jsx=automatic", `--outfile=${bundlePath}`],
      { cwd: repoRoot, encoding: "utf8", timeout: 120000, env: { ...process.env, NODE_PATH: join(repoRoot, "node_modules") } },
    );
    if (bundle.status !== 0) throw new Error(bundle.stderr || bundle.stdout || "esbuild bundle failed");
    const proc = spawnSync(process.execPath, [bundlePath, JSON.stringify({ scene, review })], {
      cwd: dir,
      encoding: "utf8",
      timeout: 120000,
    });
    if (proc.status !== 0) throw new Error(proc.stderr || proc.stdout || "render failed");
    return proc.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("review mode renders per-edge confidence and competing-hypothesis marks", () => {
  const scene = annotatedScene();
  const markup = renderScene(scene, true);
  const firstEdge = scene.edges[0];
  const edgeGroup = markup.match(new RegExp(`<g[^>]*data-edge-id="${firstEdge.id}"[^>]*>`))?.[0];
  assert.ok(edgeGroup, "first edge group must render");
  assert.match(edgeGroup!, /confidence-high/);
  assert.match(edgeGroup!, /competing-hypothesis/);
  assert.match(edgeGroup!, /data-confidence="high"/);
  assert.match(edgeGroup!, /data-competing-hypothesis="true"/);
  assert.match(markup, /class="review-mark"/);
  assert.match(markup, />H</);
  assert.match(markup, /class="review-mark competing"/);
});

test("review marks stay off when review mode is disabled", () => {
  const scene = annotatedScene();
  const markup = renderScene(scene, false);
  for (const edge of scene.edges) {
    const group = markup.match(new RegExp(`<g[^>]*data-edge-id="${edge.id}"[^>]*>`))?.[0];
    assert.ok(group, `edge ${edge.id} must render`);
    assert.doesNotMatch(group!, /confidence-/);
    assert.doesNotMatch(group!, /competing-hypothesis/);
    assert.doesNotMatch(group!, /data-confidence=/);
    assert.doesNotMatch(group!, /data-competing-hypothesis=/);
  }
  for (const block of scene.blocks) {
    const group = markup.match(new RegExp(`<g[^>]*data-block-id="${block.id}"[^>]*>`))?.[0];
    assert.ok(group, `block ${block.id} must render`);
    assert.doesNotMatch(group!, /confidence-/);
    assert.doesNotMatch(group!, /competing-hypothesis/);
    assert.doesNotMatch(group!, /data-confidence=/);
  }
  assert.doesNotMatch(markup, /class="review-mark"/);
});

test("review mode renders block confidence and competing-hypothesis marks", () => {
  const scene = annotatedScene();
  const markup = renderScene(scene, true);
  const firstBlock = scene.blocks[0];
  const blockGroup = markup.match(new RegExp(`<g[^>]*data-block-id="${firstBlock.id}"[^>]*>`))?.[0];
  assert.ok(blockGroup, "first block group must render");
  assert.match(blockGroup!, /confidence-medium/);
  assert.match(blockGroup!, /competing-hypothesis/);
  assert.match(blockGroup!, /data-confidence="medium"/);
  assert.match(blockGroup!, /data-competing-hypothesis="true"/);
});
