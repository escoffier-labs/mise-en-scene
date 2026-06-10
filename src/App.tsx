import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sceneCss, standaloneCss } from "./sceneStyles";

type Audience = "engineer" | "exec" | "student" | "customer";
type ExplainerMode = "architecture" | "request" | "risk" | "timeline";
type Zone = "source" | "orchestration" | "artifact" | "guardrail";

type SceneBlock = {
  id: string;
  label: string;
  kicker: string;
  detail: string;
  zone: Zone;
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

const zoneColors: Record<Zone, { fill: string; stroke: string; chip: string }> = {
  source: { fill: "#171717", stroke: "#3a3a36", chip: "#d8d4c7" },
  orchestration: { fill: "#191b1a", stroke: "#43433d", chip: "#c6d4c0" },
  artifact: { fill: "#1c1b18", stroke: "#4a4438", chip: "#e6c99f" },
  guardrail: { fill: "#1a1917", stroke: "#5a4b43", chip: "#d8a69a" },
};

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
  return truncateText(facts[index] ?? fallback, 92);
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
      zone: "source",
      x: 88,
      y: 226,
      w: 182,
      h: 86,
    },
    {
      id: "extract",
      label: "Ingestion pass",
      kicker: "STRUCTURE",
      detail: blockDetail(facts, 1, "Extract actors, interfaces, systems, data stores, decisions, and flows."),
      zone: "orchestration",
      x: 352,
      y: 148,
      w: 190,
      h: 90,
    },
    {
      id: "planner",
      label: "Explainer planner",
      kicker: "STORY",
      detail: blockDetail(facts, 2, "Choose the right explainer pattern, audience depth, mode chips, and callout sequence."),
      zone: "orchestration",
      x: 585,
      y: 238,
      w: 198,
      h: 92,
    },
    {
      id: "renderer",
      label: "HTML/SVG renderer",
      kicker: "SCENE",
      detail: blockDetail(facts, 3, "Render a self-contained interactive scene with highlighted paths and callouts."),
      zone: "artifact",
      x: 856,
      y: 164,
      w: 194,
      h: 92,
    },
    {
      id: "qa",
      label: "Browser QA loop",
      kicker: "REPAIR",
      detail: blockDetail(facts, 4, "Check labels, spacing, contrast, click targets, overflow, and export fidelity."),
      zone: "guardrail",
      x: 858,
      y: 364,
      w: 194,
      h: 92,
    },
    {
      id: "artifact",
      label: "Explainer artifact",
      kicker: "OUTPUT",
      detail: blockDetail(facts, 5, "Save editable HTML, JSON scene data, screenshots, or recorded walkthroughs."),
      zone: "artifact",
      x: 586,
      y: 494,
      w: 198,
      h: 92,
    },
    {
      id: "brigade",
      label: "Brigade runtime",
      kicker: "ORCHESTRATION",
      detail: "Runs grounding, model routing, tool calls, browser checks, and artifact export when the pipeline grows beyond local heuristics.",
      zone: "orchestration",
      x: 352,
      y: 412,
      w: 190,
      h: 92,
    },
    {
      id: "evidence",
      label: "Evidence ledger",
      kicker: "GROUNDING",
      detail: "Keeps assumptions, source snippets, citations, and regeneration history attached to the scene.",
      zone: "guardrail",
      x: 95,
      y: 456,
      w: 178,
      h: 86,
    },
  ];

  const edges: SceneEdge[] = [
    { from: "source", to: "extract", label: "parse", modes: ["architecture", "request", "risk", "timeline"] },
    { from: "extract", to: "planner", label: "model", modes: ["architecture", "request", "risk", "timeline"] },
    { from: "planner", to: "renderer", label: "compose", modes: ["architecture", "request"] },
    { from: "renderer", to: "qa", label: "inspect", modes: ["architecture", "risk", "timeline"] },
    { from: "qa", to: "artifact", label: "approve", modes: ["architecture", "timeline"] },
    { from: "brigade", to: "planner", label: "route", modes: ["architecture", "request"] },
    { from: "evidence", to: "extract", label: "ground", modes: ["architecture", "risk"] },
    { from: "artifact", to: "planner", label: "revise", modes: ["request", "risk"] },
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

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}...` : word;

    if (lines.length === maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = truncateText(lines[maxLines - 1], maxChars);
  }

  return lines;
}

function blockCenter(block: SceneBlock) {
  return { x: block.x + block.w / 2, y: block.y + block.h / 2 };
}

function edgePath(from: SceneBlock, to: SceneBlock) {
  const start = blockCenter(from);
  const end = blockCenter(to);
  const curve = Math.max(70, Math.abs(end.x - start.x) * 0.34);
  return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`;
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

function SceneSvg({
  scene,
  activeMode,
  selectedId,
  onSelect,
  onModeChange,
}: {
  scene: Scene;
  activeMode: ExplainerMode;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onModeChange?: (mode: ExplainerMode) => void;
}) {
  const blockById = new Map(scene.blocks.map((block) => [block.id, block]));
  const callout = modeCallouts[activeMode];
  const activeEdges = scene.edges.filter((edge) => edge.modes.includes(activeMode));
  const activeIds = new Set(activeEdges.flatMap((edge) => [edge.from, edge.to]));
  const canvasTitle = truncateText(scene.title, 42);

  return (
    <svg viewBox="0 0 1180 720" role="img" aria-label={`${scene.title} interactive scene`}>
      <style>{sceneCss}</style>
      <defs>
        <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
          <path d="M2,2 L10,6 L2,10 Z" fill="#9fb0c7" />
        </marker>
        <linearGradient id="stage-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#111210" />
          <stop offset="55%" stopColor="#0d0e0c" />
          <stop offset="100%" stopColor="#0a0b0a" />
        </linearGradient>
        <filter id="soft">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#000" floodOpacity=".3" />
        </filter>
      </defs>

      <rect width="1180" height="720" fill="url(#stage-bg)" />
      <rect x="672" y="0" width="506" height="720" className="stage-wash" />
      <rect x="42" y="124" width="250" height="496" rx="8" className="zone-frame" />
      <rect x="316" y="124" width="502" height="496" rx="8" className="zone-frame" />
      <rect x="842" y="124" width="296" height="496" rx="8" className="zone-frame" />
      <path d="M0 88 H1180 M0 642 H1180" className="stage-grid" />
      <text x="38" y="48" className="scene-title">
        {canvasTitle}
      </text>
      <text x="40" y="72" className="scene-summary">
        {scene.summary}
      </text>
      <text x="62" y="152" className="zone-title">
        SOURCE
      </text>
      <text x="340" y="152" className="zone-title">
        ORCHESTRATION
      </text>
      <text x="864" y="152" className="zone-title">
        ARTIFACT + QA
      </text>

      {modes.map((item, index) => {
        const active = item === activeMode;
        const x = 682 + index * 108;
        return (
          <g
            key={item}
            role="button"
            tabIndex={0}
            className="scene-mode"
            onClick={() => onModeChange?.(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onModeChange?.(item);
            }}
          >
            <rect x={x} y="22" width="96" height="26" rx="13" className={active ? "scene-mode-active" : ""} />
            <text x={x + 48} y="39" textAnchor="middle" className={active ? "scene-mode-text-active" : "scene-mode-text"}>
              {modeLabels[item]}
            </text>
          </g>
        );
      })}

      <g filter="url(#soft)">
        {scene.edges.map((edge) => {
          const from = blockById.get(edge.from)!;
          const to = blockById.get(edge.to)!;
          const active = edge.modes.includes(activeMode);
          const path = edgePath(from, to);
          return (
            <g key={`${edge.from}-${edge.to}`} className={active ? "flow active" : "flow"}>
              <path d={path} markerEnd="url(#arrow)" />
              <path id={`path-${edge.from}-${edge.to}`} d={path} fill="none" stroke="none" />
              <text>
                <textPath href={`#path-${edge.from}-${edge.to}`} startOffset="50%">
                  {edge.label}
                </textPath>
              </text>
            </g>
          );
        })}

        {scene.blocks.map((block) => {
          const colors = zoneColors[block.zone];
          const active = activeIds.has(block.id) || activeMode === "architecture";
          const selected = selectedId === block.id;
          const label = truncateText(block.label, Math.max(16, Math.floor((block.w - 32) / 8.4)));
          const detailLines = wrapText(block.detail, Math.max(18, Math.floor((block.w - 32) / 6.2)), 2);
          return (
            <g
              key={block.id}
              className={`scene-block ${active ? "active" : ""} ${selected ? "selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(block.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect?.(block.id);
              }}
            >
              <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="8" fill={colors.fill} stroke={selected ? "#f4efe5" : active ? colors.chip : colors.stroke} />
              <text x={block.x + 16} y={block.y + 24} className="block-kicker">
                {block.kicker}
              </text>
              <text x={block.x + 16} y={block.y + 50} className="block-label">
                {label}
              </text>
              <text x={block.x + 16} y={block.y + 72} className="block-zone">
                {detailLines.map((line, index) => (
                  <tspan key={`${block.id}-${index}`} x={block.x + 16} dy={index === 0 ? 0 : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>

      <g className="callout">
        <rect x="870" y="520" width="238" height="108" rx="8" />
        <text x="894" y="552" className="callout-title">
          {callout.title}
        </text>
        <foreignObject x="894" y="568" width="184" height="48">
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
            <SceneSvg scene={scene} activeMode={mode} />
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
          <p className="eyebrow">Escoffier Labs</p>
          <h1>Mise en Scene</h1>
        </div>
        <div className="actions" aria-label="Artifact actions">
          <span className="export-status" role="status" aria-live="polite">
            {exportNotice}
          </span>
          <button onClick={() => handleExport("mise-en-scene.html", standaloneHtml(scene, mode), "text/html")}>Export HTML</button>
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
              <SceneSvg scene={scene} activeMode={mode} selectedId={selected.id} onSelect={setSelectedId} onModeChange={setMode} />
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
