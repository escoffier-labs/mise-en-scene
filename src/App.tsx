import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { T, sceneCss, standaloneCss } from "./sceneStyles";

type Audience = "engineer" | "exec" | "student" | "customer";
type ExplainerMode = "architecture" | "request" | "risk" | "timeline";

type SceneBlock = {
  id: string;
  label: string;
  kicker: string;
  detail: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type SceneEdge = {
  from: string;
  to: string;
  label: string;
  modes: Array<ExplainerMode>;
  dashed?: boolean;
};

type SceneZone = {
  label: string;
  desc: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Scene = {
  title: string;
  subtitle: string;
  summary: string;
  facts: string[];
  terms: string[];
  blocks: SceneBlock[];
  edges: SceneEdge[];
};

const sampleSource = `Mise en Scene takes a source artifact such as an OpenAPI spec, README, incident report, architecture note, or pasted system description.

The ingestion step extracts actors, interfaces, services, data stores, decisions, and flows. A planner chooses the best explainer pattern for the audience. The renderer creates a self-contained HTML/SVG scene with clickable modes, highlighted paths, and callouts. A browser QA loop checks labels, spacing, contrast, and export output before the explainer is saved. Brigade can run the research, grounding, model routing, browser checks, and artifact export under the hood.`;

const audienceCopy: Record<Audience, string> = {
  engineer: "Implementation view: interfaces, boundaries, source evidence, and failure paths.",
  exec: "Decision view: purpose, ownership, risk, and what changes for the organization.",
  student: "Teaching view: definitions, sequence, cause/effect, and concrete examples.",
  customer: "Trust view: outcomes, data movement, privacy, and handoff points.",
};

const audiences = Object.keys(audienceCopy) as Audience[];

const modeLabels: Record<ExplainerMode, string> = {
  architecture: "Everything",
  request: "Create",
  risk: "Review",
  timeline: "Export",
};

const modes = Object.keys(modeLabels) as ExplainerMode[];

const modeTitles: Record<ExplainerMode, string> = {
  architecture: "System map",
  request: "Source to scene",
  risk: "Grounding and QA",
  timeline: "Artifact delivery",
};

const sceneZones: SceneZone[] = [
  { label: "SOURCE", desc: "what the explainer is grounded in", x: 48, y: 116, w: 264, h: 500 },
  { label: "ORCHESTRATION", desc: "planning, routing, and revision", x: 344, y: 116, w: 512, h: 500 },
  { label: "ARTIFACT + QA", desc: "what ships and what checks it", x: 888, y: 116, w: 344, h: 500 },
];

function titleFromSource(source: string, mode: ExplainerMode) {
  const firstLine = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 16);

  if (!firstLine) return `${modeTitles[mode]} explainer`;
  const cleaned = firstLine.replace(/[#*_`>]/g, "").slice(0, 88);
  return cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned;
}

function splitFacts(source: string) {
  return source
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 24)
    .slice(0, 6);
}

function extractTerms(source: string) {
  const stop = new Set([
    "the",
    "and",
    "with",
    "from",
    "that",
    "this",
    "into",
    "before",
    "after",
    "such",
    "under",
    "their",
    "when",
    "then",
    "what",
    "where",
    "which",
    "will",
    "would",
    "could",
    "should",
  ]);

  const counts = new Map<string, number>();
  source
    .replace(/[`"'()[\]{}.,:;!?/\\]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3)
    .forEach((word) => {
      const normalized = word.toLowerCase();
      if (!stop.has(normalized)) counts.set(word, (counts.get(word) ?? 0) + 1);
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 10);
}

function blockDetail(facts: string[], index: number, fallback: string) {
  return truncateText(facts[index] ?? fallback, 140);
}

function createScene(source: string, audience: Audience, mode: ExplainerMode): Scene {
  const facts = splitFacts(source);
  const terms = extractTerms(source);
  const title = titleFromSource(source, mode);

  const blocks: SceneBlock[] = [
    {
      id: "source",
      label: "Source material",
      kicker: "INPUT",
      detail: blockDetail(facts, 0, "Repo, OpenAPI spec, README, architecture note, incident report, or pasted context."),
      x: 72,
      y: 196,
      w: 216,
      h: 92,
    },
    {
      id: "extract",
      label: "Ingestion pass",
      kicker: "STRUCTURE",
      detail: blockDetail(facts, 1, "Extract actors, interfaces, systems, data stores, decisions, and flows."),
      x: 376,
      y: 176,
      w: 216,
      h: 92,
    },
    {
      id: "planner",
      label: "Explainer planner",
      kicker: "STORY",
      detail: blockDetail(facts, 2, "Choose the right explainer pattern, audience depth, mode chips, and callout sequence."),
      x: 620,
      y: 300,
      w: 212,
      h: 96,
    },
    {
      id: "renderer",
      label: "HTML/SVG renderer",
      kicker: "SCENE",
      detail: blockDetail(facts, 3, "Render a self-contained interactive scene with highlighted paths and callouts."),
      x: 912,
      y: 176,
      w: 296,
      h: 92,
    },
    {
      id: "qa",
      label: "Browser QA loop",
      kicker: "REPAIR",
      detail: blockDetail(facts, 4, "Check labels, spacing, contrast, click targets, overflow, and export fidelity."),
      x: 912,
      y: 330,
      w: 296,
      h: 92,
    },
    {
      id: "artifact",
      label: "Explainer artifact",
      kicker: "OUTPUT",
      detail: blockDetail(facts, 5, "Save editable HTML, JSON scene data, screenshots, or recorded walkthroughs."),
      x: 912,
      y: 484,
      w: 296,
      h: 92,
    },
    {
      id: "brigade",
      label: "Brigade runtime",
      kicker: "ORCHESTRATION",
      detail: "Runs grounding, model routing, tool calls, browser checks, and artifact export when the pipeline grows beyond local heuristics.",
      x: 376,
      y: 440,
      w: 216,
      h: 92,
    },
    {
      id: "evidence",
      label: "Evidence ledger",
      kicker: "GROUNDING",
      detail: "Keeps assumptions, source snippets, citations, and regeneration history attached to the scene.",
      x: 72,
      y: 420,
      w: 216,
      h: 92,
    },
  ];

  const edges: SceneEdge[] = [
    { from: "source", to: "extract", label: "parse", modes: ["architecture", "request", "risk", "timeline"] },
    { from: "extract", to: "planner", label: "model", modes: ["architecture", "request", "risk", "timeline"] },
    { from: "planner", to: "renderer", label: "compose", modes: ["architecture", "request"] },
    { from: "renderer", to: "qa", label: "inspect", modes: ["architecture", "risk", "timeline"] },
    { from: "qa", to: "artifact", label: "approve", modes: ["architecture", "timeline"] },
    { from: "brigade", to: "planner", label: "route", modes: ["architecture", "request"] },
    { from: "evidence", to: "extract", label: "ground", modes: ["architecture", "risk"], dashed: true },
    { from: "artifact", to: "planner", label: "revise", modes: ["request", "risk"], dashed: true },
  ];

  const summaries: Record<ExplainerMode, string> = {
    architecture: "Focus: show the full source-to-artifact system and its control points.",
    request: "Focus: follow one create request as it becomes an interactive explainer.",
    risk: "Focus: expose where the explanation can drift, leak context, or fail visual QA.",
    timeline: "Focus: move from source intake to an exportable artifact with review gates.",
  };

  return {
    title,
    subtitle: audienceCopy[audience],
    summary: summaries[mode],
    facts,
    terms,
    blocks,
    edges,
  };
}

function truncateText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3).trim()}...` : compact;
}

function blockCenter(block: SceneBlock) {
  return { x: block.x + block.w / 2, y: block.y + block.h / 2 };
}

// Edges leave and enter card sides (not centers), curve through the gutters,
// and report their midpoint so labels can sit on the line.
function edgeGeometry(from: SceneBlock, to: SceneBlock) {
  const fc = blockCenter(from);
  const tc = blockCenter(to);

  let start: { x: number; y: number };
  let end: { x: number; y: number };
  let horizontal: boolean;

  if (to.x >= from.x + from.w) {
    start = { x: from.x + from.w, y: fc.y };
    end = { x: to.x - 6, y: tc.y };
    horizontal = true;
  } else if (to.x + to.w <= from.x) {
    start = { x: from.x, y: fc.y };
    end = { x: to.x + to.w + 6, y: tc.y };
    horizontal = true;
  } else if (tc.y >= fc.y) {
    start = { x: fc.x, y: from.y + from.h };
    end = { x: tc.x, y: to.y - 6 };
    horizontal = false;
  } else {
    start = { x: fc.x, y: from.y };
    end = { x: tc.x, y: to.y + to.h + 6 };
    horizontal = false;
  }

  const span = horizontal ? end.x - start.x : end.y - start.y;
  const bend = Math.sign(span || 1) * Math.max(36, Math.abs(span) * 0.45);
  const c1 = horizontal ? { x: start.x + bend, y: start.y } : { x: start.x, y: start.y + bend };
  const c2 = horizontal ? { x: end.x - bend, y: end.y } : { x: end.x, y: end.y - bend };
  const mid = {
    x: 0.125 * (start.x + end.x) + 0.375 * (c1.x + c2.x),
    y: 0.125 * (start.y + end.y) + 0.375 * (c1.y + c2.y),
  };

  return {
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    mid,
  };
}

const modeCallouts: Record<ExplainerMode, { title: string; body: string }> = {
  architecture: {
    title: "Everything view",
    body: "The product arranges source, orchestration, guardrails, and artifact output into a single inspectable scene.",
  },
  request: {
    title: "Create flow",
    body: "The scene is planned from source structure, then rendered into HTML/SVG with editable paths and callouts.",
  },
  risk: {
    title: "Review flow",
    body: "Grounding and browser QA stay visible so bad assumptions, overflow, and private context do not sneak into the artifact.",
  },
  timeline: {
    title: "Export flow",
    body: "The approved scene becomes a standalone HTML explainer, JSON scene model, screenshot, or recorded walkthrough.",
  },
};

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const CHIP_GAP = 8;
const CHIP_ROW_END = 1232;
const chipWidths = modes.map((mode) => Math.round(modeLabels[mode].length * 6.3) + 26);
const chipRowStart = CHIP_ROW_END - chipWidths.reduce((sum, w) => sum + w, 0) - CHIP_GAP * (modes.length - 1);

function SceneSvg({
  scene,
  activeMode,
  meta,
  selectedId,
  onSelect,
  onModeChange,
  staticExport,
}: {
  scene: Scene;
  activeMode: ExplainerMode;
  meta?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onModeChange?: (mode: ExplainerMode) => void;
  staticExport?: boolean;
}) {
  const blockById = new Map(scene.blocks.map((block) => [block.id, block]));
  const callout = modeCallouts[activeMode];
  const activeEdges = scene.edges.filter((edge) => edge.modes.includes(activeMode));
  const activeIds = new Set(activeEdges.flatMap((edge) => [edge.from, edge.to]));

  let chipX = chipRowStart;

  return (
    <svg
      viewBox="0 0 1280 780"
      role={staticExport ? "img" : "group"}
      aria-label={`${scene.title} interactive scene`}
    >
      <style>{sceneCss}</style>
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
          <path d="M1,1 L7,4 L1,7 Z" fill={T.edge} />
        </marker>
        <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
          <path d="M1,1 L7,4 L1,7 Z" fill={T.accent} />
        </marker>
      </defs>

      <rect width="1280" height="780" fill={T.bg} />

      <text x="48" y="58" className="scene-title">
        {truncateText(scene.title, 64)}
      </text>
      <text x="48" y="84" className="scene-summary">
        {truncateText(scene.summary, 110)}
      </text>
      {meta ? (
        <text x={CHIP_ROW_END} y="84" textAnchor="end" className="scene-meta">
          {meta}
        </text>
      ) : null}

      {modes.map((item, index) => {
        const active = item === activeMode;
        const x = chipX;
        chipX += chipWidths[index] + CHIP_GAP;
        return (
          <g
            key={item}
            role="button"
            tabIndex={0}
            aria-label={`Switch to ${modeLabels[item]} mode`}
            className="scene-mode"
            onClick={() => onModeChange?.(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onModeChange?.(item);
              }
            }}
          >
            <rect x={x} y="28" width={chipWidths[index]} height="28" rx="14" className={active ? "scene-mode-active" : ""} />
            <text x={x + chipWidths[index] / 2} y="46" textAnchor="middle" className={active ? "scene-mode-text-active" : "scene-mode-text"}>
              {modeLabels[item]}
            </text>
          </g>
        );
      })}

      {sceneZones.map((zone) => (
        <g key={zone.label}>
          <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx="10" className="zone-frame" />
          <text x={zone.x + 24} y={zone.y + 32} className="zone-title">
            {zone.label}
          </text>
          <text x={zone.x + 24} y={zone.y + 50} className="zone-desc">
            {zone.desc}
          </text>
        </g>
      ))}

      {scene.edges.map((edge) => {
        const from = blockById.get(edge.from)!;
        const to = blockById.get(edge.to)!;
        const active = edge.modes.includes(activeMode);
        const { path, mid } = edgeGeometry(from, to);
        return (
          <g key={`${edge.from}-${edge.to}`} className={`flow ${active ? "active" : ""} ${edge.dashed ? "dashed" : ""}`}>
            <path d={path} markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"} />
            <text x={mid.x} y={mid.y - 6} textAnchor="middle" className="flow-label">
              {edge.label}
            </text>
          </g>
        );
      })}

      {scene.blocks.map((block) => {
        const active = activeIds.has(block.id) || activeMode === "architecture";
        const selected = selectedId === block.id;
        return (
          <g
            key={block.id}
            className={`scene-block ${active ? "active" : ""} ${selected ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={block.label}
            onClick={() => onSelect?.(block.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(block.id);
              }
            }}
          >
            <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="10" className="card-rect" />
            <foreignObject x={block.x} y={block.y} width={block.w} height={block.h}>
              <div className="card">
                <h3>{block.label}</h3>
                <p>{block.detail}</p>
              </div>
            </foreignObject>
          </g>
        );
      })}

      <g className="callout">
        <rect x="48" y="648" width="400" height="112" rx="10" />
        <text x="72" y="682" className="callout-title">
          {callout.title}
        </text>
        <foreignObject x="72" y="694" width="352" height="54">
          <p>{callout.body}</p>
        </foreignObject>
      </g>
    </svg>
  );
}

function StandalonePage({ scene, mode }: { scene: Scene; mode: ExplainerMode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${scene.title} - Mise en Scene`}</title>
        <style>{standaloneCss}</style>
      </head>
      <body>
        <main>
          <h1>{scene.title}</h1>
          <p>
            {scene.subtitle} Mode: {modeLabels[mode]}.
          </p>
          <section className="scene">
            <SceneSvg scene={scene} activeMode={mode} staticExport />
          </section>
          <section className="meta">
            <div className="panel">
              <h2>Source-grounded facts</h2>
              <ul>{scene.facts.length ? scene.facts.map((fact) => <li key={fact}>{fact}</li>) : <li>No source facts extracted yet.</li>}</ul>
            </div>
            <div className="panel">
              <h2>Terms</h2>
              {scene.terms.map((term) => (
                <span key={term}>{term}</span>
              ))}
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}

function standaloneHtml(scene: Scene, mode: ExplainerMode) {
  return `<!doctype html>\n${renderToStaticMarkup(<StandalonePage scene={scene} mode={mode} />)}`;
}

function usePersistentState<T extends string>(key: string, initial: T, allowed?: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key) as T | null;
    if (stored === null) return initial;
    return !allowed || allowed.includes(stored) ? stored : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

export default function App() {
  const [source, setSource] = usePersistentState<string>("mise-source", sampleSource);
  const [audience, setAudience] = usePersistentState<Audience>("mise-audience", "engineer", audiences);
  const [mode, setMode] = usePersistentState<ExplainerMode>("mise-mode", "architecture", modes);
  const [selectedId, setSelectedId] = useState("source");
  const [manualTitle, setManualTitle] = useState("");
  const [exportNotice, setExportNotice] = useState("Ready");

  const scene = useMemo(() => {
    const generated = createScene(source, audience, mode);
    return manualTitle.trim() ? { ...generated, title: manualTitle.trim() } : generated;
  }, [source, audience, mode, manualTitle]);

  const selected = scene.blocks.find((block) => block.id === selectedId) ?? scene.blocks[0];
  const visibleFacts = scene.facts.slice(0, 3);
  const visibleTerms = scene.terms.slice(0, 7);

  function handleExport(filename: string, content: string, type: string) {
    download(filename, content, type);
    setExportNotice(`${filename} exported`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Escoffier Labs &middot; the studio</p>
          <h1 className="wordmark">
            mise-en-scene<span className="wordmark-cursor">_</span>
          </h1>
        </div>
        <div className="actions" aria-label="Artifact actions">
          <span className="export-status" role="status" aria-live="polite">
            {exportNotice}
          </span>
          <button className="primary" onClick={() => handleExport("mise-en-scene.html", standaloneHtml(scene, mode), "text/html")}>
            Export HTML
          </button>
          <button onClick={() => handleExport("mise-en-scene.json", JSON.stringify(scene, null, 2), "application/json")}>Export JSON</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel source-panel">
          <div className="panel-head">
            <h2>Source</h2>
            <button className="small" onClick={() => setSource(sampleSource)}>
              Sample
            </button>
          </div>
          <label>
            Title override
            <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Optional scene title" />
          </label>
          <label>
            Source material
            <textarea value={source} onChange={(event) => setSource(event.target.value)} />
          </label>
          <label>
            Audience
            <select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
              <option value="engineer">Engineer</option>
              <option value="exec">Executive</option>
              <option value="student">Student</option>
              <option value="customer">Customer</option>
            </select>
          </label>
        </aside>

        <section className="artifact-workbench">
          <section className="stage-panel">
            <div className="stage">
              <SceneSvg
                scene={scene}
                activeMode={mode}
                meta={`${audience} audience · ${modeLabels[mode].toLowerCase()} mode`}
                selectedId={selected.id}
                onSelect={setSelectedId}
                onModeChange={setMode}
              />
            </div>
          </section>

          <section className="detail-rail">
            <div className="rail-card selected-card">
              <span>{selected.kicker}</span>
              <h2>{selected.label}</h2>
              <p>{selected.detail}</p>
            </div>
            <div className="rail-card">
              <h2>Source facts</h2>
              <ol>
                {visibleFacts.length ? visibleFacts.map((fact) => <li key={fact}>{truncateText(fact, 150)}</li>) : <li>Add more source detail to ground the scene.</li>}
              </ol>
            </div>
            <div className="rail-card terms-card">
              <h2>Terms</h2>
              <div className="term-list">
                {visibleTerms.map((term) => (
                  <span key={term} title={term}>
                    {truncateText(term, 30)}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
