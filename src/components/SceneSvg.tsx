import { sceneCss, T } from "../sceneStyles";
import type { Confidence, SceneBlock, SceneDocument } from "../scene/types";
import type { Spotlight } from "../scene/walkthrough";
import { onActivateKeyDown } from "./activateKey";

type Props = { scene: SceneDocument; selectedId?: string; review?: boolean; spotlight?: Spotlight | null; camera?: string; onSelect?: (type: "block" | "edge", id: string) => void };
type Analytic = { confidence?: Confidence; competingHypothesis?: boolean };

const CONFIDENCE_MARK: Record<Confidence, string> = { high: "H", medium: "M", low: "L" };

// Extra class applied when a walkthrough step is being rendered: the active
// edge and its endpoints get "walk-on", everything else "walk-dim". Absent when
// no spotlight is set (live studio and non-walkthrough exports).
function walk(spotlight: Spotlight | null | undefined, id: string, isEdge: boolean): string {
  if (!spotlight) return "";
  const active = isEdge ? spotlight.edgeId === id : spotlight.blockIds.includes(id);
  return active ? "walk-on" : "walk-dim";
}

function reviewClass(review: boolean | undefined, item: Analytic): string {
  if (!review) return "";
  const parts: string[] = [];
  if (item.confidence) parts.push(`confidence-${item.confidence}`);
  if (item.competingHypothesis) parts.push("competing-hypothesis");
  return parts.join(" ");
}

function reviewAttrs(review: boolean | undefined, item: Analytic): Record<string, string> {
  if (!review) return {};
  const attrs: Record<string, string> = {};
  if (item.confidence) attrs["data-confidence"] = item.confidence;
  if (item.competingHypothesis) attrs["data-competing-hypothesis"] = "true";
  return attrs;
}

function ReviewMarks({ x, y, review, item }: { x: number; y: number; review?: boolean; item: Analytic }) {
  if (!review || (!item.confidence && !item.competingHypothesis)) return null;
  const marks: Array<{ key: string; label: string; className: string; dx: number }> = [];
  let dx = 0;
  if (item.confidence) {
    marks.push({ key: "confidence", label: CONFIDENCE_MARK[item.confidence], className: "review-mark", dx });
    dx += 12;
  }
  if (item.competingHypothesis) {
    marks.push({ key: "hypothesis", label: "?", className: "review-mark competing", dx });
  }
  return <>{marks.map((mark) => <text key={mark.key} x={x + mark.dx} y={y} textAnchor="middle" className={mark.className}>{mark.label}</text>)}</>;
}

export function SceneSvg({ scene, selectedId, review, spotlight, camera, onSelect }: Props) {
  const byId = new Map(scene.blocks.map((block) => [block.id, block]));
  const body = scene.view === "sequence"
    ? <Sequence scene={scene} selectedId={selectedId} review={review} spotlight={spotlight} onSelect={onSelect}/>
    : <Architecture scene={scene} byId={byId} selectedId={selectedId} review={review} spotlight={spotlight} onSelect={onSelect}/>;
  return <svg viewBox="0 0 1280 780" role="group" aria-label={`${scene.title} ${scene.view} scene`}>
    <style>{sceneCss}</style><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto"><path d="M1,1 L7,4 L1,7 Z" fill={T.accent}/></marker></defs>
    <rect width="1280" height="780" fill={T.bg}/><text x="48" y="58" className="scene-title">{short(scene.title, 64)}</text><text x="48" y="84" className="scene-summary">{short(scene.summary, 110)}</text>
    {camera !== undefined ? <g className="stage-camera" transform={camera}>{body}</g> : body}
  </svg>;
}

function Architecture({ scene, byId, selectedId, review, spotlight, onSelect }: Props & { byId: Map<string, SceneBlock> }) {
  return <>{scene.edges.map((edge) => {
    const a = byId.get(edge.from)!;
    const b = byId.get(edge.to)!;
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dim = review && !edge.factIds.length;
    const analytic = reviewClass(review, edge);
    return <g key={edge.id} data-edge-id={edge.id} role="button" tabIndex={0} className={`flow active ${selectedId === edge.id ? "selected" : ""} ${dim ? "ungrounded" : ""} ${analytic} ${walk(spotlight, edge.id, true)}`} {...reviewAttrs(review, edge)} onClick={() => onSelect?.("edge", edge.id)} onKeyDown={onActivateKeyDown(() => onSelect?.("edge", edge.id))}>
      <path d={`M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} markerEnd="url(#arrow)"/>
      <text x={mx} y={my - 8} textAnchor="middle" className="flow-label">{edge.label}</text>
      <ReviewMarks x={mx + 28} y={my - 8} review={review} item={edge}/>
    </g>;
  })}{scene.blocks.map((block) => <Card key={block.id} block={block} selected={selectedId === block.id} dim={!!review && !block.factIds.length} review={review} walk={walk(spotlight, block.id, false)} onSelect={onSelect}/>)}</>;
}

function Sequence({ scene, selectedId, review, spotlight, onSelect }: Props) {
  const byId = new Map(scene.blocks.map((b) => [b.id, b]));
  const active = new Set<string>(); scene.edges.forEach((e) => { active.add(e.from); active.add(e.to); });
  const participants = active.size ? scene.blocks.filter((b) => active.has(b.id)) : scene.blocks;
  const cx = (b: SceneBlock) => b.x + b.w / 2;
  const msgTop = 208, msgBottom = 712, lifelineEnd = 736;
  const step = scene.edges.length ? Math.min(60, (msgBottom - msgTop) / scene.edges.length) : 0;
  return <>{participants.map((block) => <g key={block.id}><line x1={cx(block)} y1={block.y + block.h} x2={cx(block)} y2={lifelineEnd} className="lifeline"/><Participant block={block} selected={selectedId === block.id} dim={!!review && !block.factIds.length} review={review} walk={walk(spotlight, block.id, false)} onSelect={onSelect}/></g>)}{scene.edges.map((edge, index) => {
    const a = byId.get(edge.from)!, b = byId.get(edge.to)!, y = Math.round(msgTop + index * step), x1 = cx(a), x2 = cx(b);
    const mx = (x1 + x2) / 2;
    const analytic = reviewClass(review, edge);
    return <g key={edge.id} data-edge-id={edge.id} role="button" tabIndex={0} className={`flow active ${selectedId === edge.id ? "selected" : ""} ${review && !edge.factIds.length ? "ungrounded" : ""} ${analytic} ${walk(spotlight, edge.id, true)}`} {...reviewAttrs(review, edge)} onClick={() => onSelect?.("edge", edge.id)} onKeyDown={onActivateKeyDown(() => onSelect?.("edge", edge.id))}>
      <text x={mx} y={y - 9} textAnchor="middle" className="flow-label">{edge.label}</text>
      <ReviewMarks x={mx + 28} y={y - 9} review={review} item={edge}/>
      <path d={`M ${x1} ${y} L ${x2} ${y}`} markerEnd="url(#arrow)"/>
    </g>;
  })}</>;
}

function Card({ block, selected, dim, review, walk, onSelect }: { block: SceneBlock; selected: boolean; dim: boolean; review?: boolean; walk: string; onSelect?: Props["onSelect"] }) {
  const analytic = reviewClass(review, block);
  return <g data-block-id={block.id} role="button" tabIndex={0} aria-label={block.label} className={`scene-block active ${selected ? "selected" : ""} ${dim ? "ungrounded" : ""} ${analytic} ${walk}`} {...reviewAttrs(review, block)} onClick={() => onSelect?.("block", block.id)} onKeyDown={onActivateKeyDown(() => onSelect?.("block", block.id))}>
    <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="10" className="card-rect"/>
    <foreignObject x={block.x} y={block.y} width={block.w} height={block.h}><div className="card" {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}><h3>{block.label}</h3><p>{block.detail}</p></div></foreignObject>
    <ReviewMarks x={block.x + block.w - 18} y={block.y + 14} review={review} item={block}/>
  </g>;
}

function Participant({ block, selected, dim, review, walk, onSelect }: { block: SceneBlock; selected: boolean; dim: boolean; review?: boolean; walk: string; onSelect?: Props["onSelect"] }) {
  const analytic = reviewClass(review, block);
  return <g data-block-id={block.id} role="button" tabIndex={0} aria-label={block.label} className={`scene-block active ${selected ? "selected" : ""} ${dim ? "ungrounded" : ""} ${analytic} ${walk}`} {...reviewAttrs(review, block)} onClick={() => onSelect?.("block", block.id)} onKeyDown={onActivateKeyDown(() => onSelect?.("block", block.id))}>
    <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="9" className="card-rect"/>
    <foreignObject x={block.x} y={block.y} width={block.w} height={block.h}><div className="participant" {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}><span>{block.label}</span></div></foreignObject>
    <ReviewMarks x={block.x + block.w - 14} y={block.y + 12} review={review} item={block}/>
  </g>;
}

function short(value: string, max: number) { return value.length > max ? `${value.slice(0, max - 3)}...` : value; }
