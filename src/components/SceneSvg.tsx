import { sceneCss, T } from "../sceneStyles";
import type { SceneBlock, SceneDocument } from "../scene/types";
import type { Spotlight } from "../scene/walkthrough";

type Props = { scene: SceneDocument; selectedId?: string; review?: boolean; spotlight?: Spotlight | null; onSelect?: (type: "block" | "edge", id: string) => void };

// Extra class applied when a walkthrough step is being rendered: the active
// edge and its endpoints get "walk-on", everything else "walk-dim". Absent when
// no spotlight is set (live studio and non-walkthrough exports).
function walk(spotlight: Spotlight | null | undefined, id: string, isEdge: boolean): string {
  if (!spotlight) return "";
  const active = isEdge ? spotlight.edgeId === id : spotlight.blockIds.includes(id);
  return active ? "walk-on" : "walk-dim";
}

export function SceneSvg({ scene, selectedId, review, spotlight, onSelect }: Props) {
  const byId = new Map(scene.blocks.map((block) => [block.id, block]));
  return <svg viewBox="0 0 1280 780" role="group" aria-label={`${scene.title} ${scene.view} scene`}>
    <style>{sceneCss}</style><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto"><path d="M1,1 L7,4 L1,7 Z" fill={T.accent}/></marker></defs>
    <rect width="1280" height="780" fill={T.bg}/><text x="48" y="58" className="scene-title">{short(scene.title, 64)}</text><text x="48" y="84" className="scene-summary">{short(scene.summary, 110)}</text>
    {scene.view === "sequence" ? <Sequence scene={scene} selectedId={selectedId} review={review} spotlight={spotlight} onSelect={onSelect}/> : <Architecture scene={scene} byId={byId} selectedId={selectedId} review={review} spotlight={spotlight} onSelect={onSelect}/>}
  </svg>;
}

function Architecture({ scene, byId, selectedId, review, spotlight, onSelect }: Props & { byId: Map<string, SceneBlock> }) {
  return <>{scene.edges.map((edge) => { const a = byId.get(edge.from)!; const b = byId.get(edge.to)!; const x1=a.x+a.w, y1=a.y+a.h/2, x2=b.x, y2=b.y+b.h/2; const dim=review&&!edge.factIds.length; return <g key={edge.id} data-edge-id={edge.id} role="button" className={`flow active ${selectedId===edge.id?"selected":""} ${dim?"ungrounded":""} ${walk(spotlight,edge.id,true)}`} onClick={()=>onSelect?.("edge",edge.id)}><path d={`M ${x1} ${y1} C ${x1+70} ${y1}, ${x2-70} ${y2}, ${x2} ${y2}`} markerEnd="url(#arrow)"/><text x={(x1+x2)/2} y={(y1+y2)/2-8} textAnchor="middle" className="flow-label">{edge.label}</text></g>})}{scene.blocks.map((block)=><Card key={block.id} block={block} selected={selectedId===block.id} dim={!!review&&!block.factIds.length} walk={walk(spotlight,block.id,false)} onSelect={onSelect}/>)}</>;
}

function Sequence({ scene, selectedId, review, spotlight, onSelect }: Props) {
  const byId = new Map(scene.blocks.map((b)=>[b.id,b]));
  return <>{scene.blocks.map((block)=><g key={block.id}><Card block={block} selected={selectedId===block.id} dim={!!review&&!block.factIds.length} walk={walk(spotlight,block.id,false)} onSelect={onSelect}/><line x1={block.x+block.w/2} y1={block.y+block.h} x2={block.x+block.w/2} y2="720" className="lifeline"/></g>)}{scene.edges.map((edge,index)=>{const a=byId.get(edge.from)!,b=byId.get(edge.to)!,y=250+index*34;return <g key={edge.id} data-edge-id={edge.id} role="button" className={`flow active ${review&&!edge.factIds.length?"ungrounded":""} ${walk(spotlight,edge.id,true)}`} onClick={()=>onSelect?.("edge",edge.id)}><path d={`M ${a.x+a.w/2} ${y} L ${b.x+b.w/2} ${y}`} markerEnd="url(#arrow)"/><text x={(a.x+a.w/2+b.x+b.w/2)/2} y={y-7} textAnchor="middle" className="flow-label">{edge.label}</text></g>})}</>;
}

function Card({ block, selected, dim, walk, onSelect }: { block: SceneBlock; selected: boolean; dim: boolean; walk: string; onSelect?: Props["onSelect"] }) { return <g data-block-id={block.id} role="button" tabIndex={0} aria-label={block.label} className={`scene-block active ${selected?"selected":""} ${dim?"ungrounded":""} ${walk}`} onClick={()=>onSelect?.("block",block.id)} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect?.("block",block.id)}}}><rect x={block.x} y={block.y} width={block.w} height={block.h} rx="10" className="card-rect"/><foreignObject x={block.x} y={block.y} width={block.w} height={block.h}><div className="card"><h3>{block.label}</h3><p>{block.detail}</p></div></foreignObject></g>; }
function short(value:string,max:number){return value.length>max?`${value.slice(0,max-3)}...`:value;}
