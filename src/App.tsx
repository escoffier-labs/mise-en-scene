import { useEffect, useMemo, useRef, useState } from "react";
import { SceneSvg } from "./components/SceneSvg";
import { extractScene } from "./scene/extract";
import { standaloneHtml, standaloneSvg, standaloneWalkthrough } from "./scene/exports";
import { layoutScene } from "./scene/layout";
import { preparePngRasterExport, prepareVideoRasterExport } from "./scene/foreignObjectRaster";
import { provenanceNarrative } from "./scene/provenance";
import { PNG_SCALE, SCENE_HEIGHT, SCENE_WIDTH, sizedSvg, svgToDataUrl } from "./scene/raster";
import { stepSpotlight, walkthroughSteps, type Viewport } from "./scene/walkthrough";
import { planWalkthroughFrames } from "./scene/walkthroughPlan";
import { formatControlState, type EncodeCapabilities, type WalkthroughVideoFormat } from "./scene/walkthroughEncode";
import { CRAWL_MAX_BYTES, CRAWL_MAX_FILES, isCrawlableFile, isIgnoredDir, parseRepoUrl, selectRemoteCandidatePaths, synthesizeSource, type CrawlFile, type RepoRef } from "./scene/crawl";
import { fetchRepoFiles } from "./scene/github";
import { T } from "./sceneStyles";
import { CONFIDENCE_LEVELS, editBlock, editEdge, type Audience, type Confidence, type SceneDocument, type SceneView } from "./scene/types";
import { validateSceneDocument } from "./scene/validate";
import { encodeWalkthroughVideo, isVideoExportSupported, probeWalkthroughEncodeCapabilities } from "./walkthroughRecorder";

const sampleSource = `# Checkout system
Customer -> Web app: starts checkout
Web app -> Checkout API: submits cart
Checkout API -> Payment gateway: authorizes payment
Checkout API -> Orders database: stores order`;

type Selection = { type: "block" | "edge"; id: string } | null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.decoding = "async"; img.onload = () => resolve(img); img.onerror = () => reject(new Error("scene could not be rasterized")); img.src = src; });
}

// Walk a File System Access directory handle, collecting crawlable text files
// within the size and count caps and skipping vendored directories.
async function readDirectory(dir: any, prefix = "", files: CrawlFile[] = []): Promise<CrawlFile[]> {
  for await (const entry of dir.values()) {
    if (files.length >= CRAWL_MAX_FILES) break;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") { if (!isIgnoredDir(entry.name)) await readDirectory(entry, path, files); }
    else if (isCrawlableFile(path)) { const file = await entry.getFile(); if (file.size <= CRAWL_MAX_BYTES) files.push({ path, text: await file.text() }); }
  }
  return files;
}

export default function App() {
  const initial = useMemo(() => extractScene(localStorage.getItem("mise-source") || sampleSource, "engineer").document, []);
  const [document, setDocument] = useState<SceneDocument>(initial);
  const [source, setSource] = useState(initial.source.text);
  const [selection, setSelection] = useState<Selection>({ type: "block", id: initial.blocks[0]?.id });
  const [review, setReview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("Ready");
  const [encodeCaps, setEncodeCaps] = useState<EncodeCapabilities | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const scene = useMemo(() => layoutScene(document, document.view), [document]);
  const selected = selection?.type === "block" ? document.blocks.find((x) => x.id === selection.id) : selection?.type === "edge" ? document.edges.find((x) => x.id === selection.id) : undefined;
  const selectedFacts = selected ? document.facts.filter((fact) => selected.factIds.includes(fact.id)) : [];
  const videoFormats = encodeCaps ? formatControlState(encodeCaps) : { webm: false, mp4: false };

  useEffect(() => {
    let cancelled = false;
    void probeWalkthroughEncodeCapabilities()
      .then((caps) => { if (!cancelled) setEncodeCaps(caps); })
      .catch(() => {
        if (!cancelled) setEncodeCaps({ mediabunnyVp9Webm: false, mediabunnyAvcMp4: false, mediaRecorderWebm: false });
      });
    return () => { cancelled = true; };
  }, []);

  function regenerate(next: string, audience = document.audience) {
    if (dirty && !window.confirm("Regenerate the scene and discard manual edits?")) return false;
    const result = extractScene(next, audience);
    result.document.view = document.view;
    setSource(next); setDocument(result.document); setDirty(false); setSelection({ type: "block", id: result.document.blocks[0]?.id });
    localStorage.setItem("mise-source", next); setNotice(result.document.warnings[0] || `Extracted ${result.document.blocks.length} elements`);
    return true;
  }
  function applyCrawl(files: CrawlFile[]) {
    const result = synthesizeSource(files);
    if (!result.source.trim()) { setNotice(result.warnings[0] || "No usable source found in the repository."); return; }
    if (regenerate(result.source)) setNotice(result.warnings.length ? `${result.summary} ${result.warnings[0]}` : result.summary);
  }
  async function openFolder() {
    const picker = (globalThis as any).showDirectoryPicker;
    if (typeof picker !== "function") { openFolderFallback(); return; }
    try { setNotice("Reading folder..."); applyCrawl(await readDirectory(await picker.call(globalThis, { mode: "read" }))); }
    catch (error) { if ((error as any)?.name === "AbortError") { setNotice("Ready"); return; } setNotice(`Folder crawl failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  }
  function openFolderFallback() {
    const input = globalThis.document.createElement("input"); input.type = "file"; (input as any).webkitdirectory = true; input.multiple = true;
    input.onchange = async () => {
      const files: CrawlFile[] = [];
      for (const file of Array.from(input.files || [])) { if (files.length >= CRAWL_MAX_FILES) break; const path = (file as any).webkitRelativePath || file.name; if (isCrawlableFile(path) && file.size <= CRAWL_MAX_BYTES) files.push({ path, text: await file.text() }); }
      applyCrawl(files);
    };
    input.click();
  }
  async function openRepoUrl() {
    const input = window.prompt("GitHub repository URL or owner/repo"); if (!input) return;
    const ref = parseRepoUrl(input); if (!ref) { setNotice("Could not parse that repository reference."); return; }
    try { setNotice(`Fetching ${ref.owner}/${ref.repo}...`); applyCrawl(await fetchRepoFiles(ref)); }
    catch (error) { setNotice(`Repository fetch failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  }

  function setView(view: SceneView) { setDocument((current) => ({ ...current, view })); setNotice(`${view} view`); }
  function select(type: "block" | "edge", id: string) { setSelection({ type, id }); }
  function updateSelected(field: "label" | "detail", value: string) {
    if (!selection) return;
    setDocument((current) => selection.type === "block" ? editBlock(current, selection.id, { [field]: value }) : editEdge(current, selection.id, value));
    setDirty(true); setNotice("Manual edits not yet exported");
  }
  function updateAnalytic(field: "confidence" | "competingHypothesis", value: Confidence | boolean | undefined) {
    if (!selection) return;
    const patch = { [field]: value } as { confidence?: Confidence; competingHypothesis?: boolean };
    setDocument((current) => selection.type === "block" ? editBlock(current, selection.id, patch) : editEdge(current, selection.id, patch));
    setDirty(true); setNotice("Manual edits not yet exported");
  }
  function chooseFact(start: number, end: number) { if (start < 0 || end < start) return; sourceRef.current?.focus(); sourceRef.current?.setSelectionRange(start, end); }
  function saveBlob(filename: string, blob: Blob) {
    const url=URL.createObjectURL(blob); const link=globalThis.document.createElement("a"); link.href=url; link.download=filename; link.click(); URL.revokeObjectURL(url);
  }
  function download(filename: string, content: string, type: string) {
    try { saveBlob(filename, new Blob([content],{type})); setNotice(`${filename} exported`); }
    catch (error) { setNotice(`Export failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  }
  async function exportPng() {
    const gate = await preparePngRasterExport();
    if (!gate.ok) { setNotice(gate.notice); return; }
    try {
      const img=await loadImage(svgToDataUrl(sizedSvg(standaloneSvg(scene,review))));
      const canvas=globalThis.document.createElement("canvas"); canvas.width=SCENE_WIDTH*PNG_SCALE; canvas.height=SCENE_HEIGHT*PNG_SCALE;
      const ctx=canvas.getContext("2d"); if (!ctx) throw new Error("canvas is unavailable");
      ctx.scale(PNG_SCALE,PNG_SCALE); ctx.drawImage(img,0,0,SCENE_WIDTH,SCENE_HEIGHT);
      const blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,"image/png")); if (!blob) throw new Error("PNG encoding failed");
      saveBlob("mise-en-scene.png",blob); setNotice("mise-en-scene.png exported");
    } catch (error) { setNotice(`PNG export failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  }
  async function recordWalkthrough(format: WalkthroughVideoFormat) {
    const caps = encodeCaps ?? await probeWalkthroughEncodeCapabilities();
    if (!encodeCaps) setEncodeCaps(caps);
    const mediaSupported = isVideoExportSupported(caps);
    const gate = await prepareVideoRasterExport({ mediaSupported });
    if (!gate.ok) { setNotice(gate.notice); return; }
    try {
      setNotice(format === "mp4" ? "Encoding walkthrough (MP4)..." : "Encoding walkthrough...");
      const steps=walkthroughSteps(scene);
      const plan=planWalkthroughFrames(scene);
      // Each step is rasterized once at full frame (spotlight baked in); the
      // camera move is a canvas crop of that bitmap driven by the frame plan.
      const images=await Promise.all(steps.map((step)=>loadImage(svgToDataUrl(sizedSvg(standaloneSvg(scene,false,stepSpotlight(step)))))));
      const canvas=globalThis.document.createElement("canvas"); canvas.width=SCENE_WIDTH; canvas.height=SCENE_HEIGHT;
      const ctx=canvas.getContext("2d"); if (!ctx) throw new Error("canvas is unavailable");
      const drawCrop=(img: HTMLImageElement, v: Viewport)=>{ ctx.fillStyle=T.bg; ctx.fillRect(0,0,SCENE_WIDTH,SCENE_HEIGHT); ctx.drawImage(img,v.x,v.y,v.w,v.h,0,0,SCENE_WIDTH,SCENE_HEIGHT); };
      const result = await encodeWalkthroughVideo({
        format,
        plan,
        images,
        canvas,
        drawCrop,
        sleep,
        probeCaps: async () => caps,
        onProgress: setNotice,
      });
      if (!result.ok) { setNotice(result.notice); return; }
      saveBlob(result.filename, result.blob);
      setNotice(`${result.filename} exported`);
    } catch (error) { setNotice(`Video encoding failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try { const parsed=JSON.parse(await file.text()); const result=validateSceneDocument(parsed); if (!result.ok) { setNotice(`Import failed: ${result.error}`); return; } setDocument(result.value); setSource(result.value.source.text); setSelection({type:"block",id:result.value.blocks[0]?.id}); setDirty(false); setNotice(`${file.name} imported`); }
    catch { setNotice("Import failed: file is not valid JSON"); }
  }

  const canExport = source.trim().length > 0;
  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">Escoffier Labs &middot; the studio</p><h1 className="wordmark">mise-en-scene<span className="wordmark-cursor">_</span></h1></div>
      <div className="actions" aria-label="Artifact actions"><span className="export-status" role="status" aria-live="polite">{notice}</span>
        <label className="file-button">Import JSON<input type="file" accept="application/json,.json" onChange={(e)=>void importFile(e.target.files?.[0])}/></label>
        <button disabled={!canExport} onClick={()=>download("mise-en-scene.svg",standaloneSvg(scene,review),"image/svg+xml")}>Export SVG</button>
        <button disabled={!canExport} onClick={()=>void exportPng()}>Export PNG</button>
        <button disabled={!canExport} onClick={()=>download("mise-en-scene.json",JSON.stringify(scene,null,2),"application/json")}>Export JSON</button>
        <button disabled={!canExport} onClick={()=>download("mise-en-scene-provenance.txt",provenanceNarrative(scene),"text/plain")}>Export provenance</button>
        <button disabled={!canExport} onClick={()=>download("mise-en-scene-walkthrough.html",standaloneWalkthrough(scene),"text/html")}>Walkthrough</button>
        <button disabled={!canExport || !videoFormats.webm} onClick={()=>void recordWalkthrough("webm")} title={videoFormats.webm ? "Encode VP9 WebM when capable, else MediaRecorder WebM" : "WebM encoding unavailable in this browser"}>Record WebM</button>
        <button disabled={!canExport || !videoFormats.mp4} onClick={()=>void recordWalkthrough("mp4")} title={videoFormats.mp4 ? "Encode AVC MP4 via MediaBunny" : "MP4 encoding unavailable in this browser"}>Record MP4</button>
        <button className="primary" disabled={!canExport} onClick={()=>download("mise-en-scene.html",standaloneHtml(scene),"text/html")}>Export HTML</button>
      </div></header>
    <section className="workspace">
      <aside className="panel source-panel"><div className="panel-head"><h2>Source</h2><div className="panel-head-actions"><button className="small" onClick={()=>void openFolder()}>Open folder</button><button className="small" onClick={()=>void openRepoUrl()}>From URL</button><button className="small" onClick={()=>regenerate(sampleSource)}>Sample</button></div></div>
        <label>Source material<textarea ref={sourceRef} value={source} onChange={(e)=>regenerate(e.target.value)} placeholder="Paste text, OpenAPI JSON, or A -> B: relationship lines"/></label>
        <label>Audience<select value={document.audience} onChange={(e)=>regenerate(source,e.target.value as Audience)}><option value="engineer">Engineer</option><option value="exec">Executive</option><option value="student">Student</option><option value="customer">Customer</option></select></label>
        <p className="source-meta">{document.source.kind === "openapi" ? "OpenAPI JSON" : "Plain text"} · {document.blocks.length} elements · {document.edges.length} relationships</p>
        {document.warnings.map((warning)=><p className="warning" key={warning}>{warning}</p>)}
      </aside>
      <section className="artifact-workbench"><div className="view-controls" aria-label="Scene view"><button className={document.view==="architecture"?"active":""} onClick={()=>setView("architecture")}>Architecture</button><button className={document.view==="sequence"?"active":""} onClick={()=>setView("sequence")}>Sequence</button><button className={review?"active":""} aria-pressed={review} onClick={()=>setReview((v)=>!v)}>Review evidence</button></div>
        <section className="stage-panel"><div className="stage"><SceneSvg scene={scene} selectedId={selection?.id} review={review} onSelect={select}/></div></section>
        <section className="detail-rail"><div className="rail-card inspector"><h2>Selected element</h2>{selected ? <><label>Label<input value={selected.label} onChange={(e)=>updateSelected("label",e.target.value)}/></label>{selection?.type==="block"&&<label>Detail<textarea value={"detail" in selected?selected.detail:""} onChange={(e)=>updateSelected("detail",e.target.value)}/></label>}{review&&<><label>Confidence<select value={selected.confidence ?? ""} onChange={(e)=>updateAnalytic("confidence", (e.target.value || undefined) as Confidence | undefined)}><option value="">Unset</option>{CONFIDENCE_LEVELS.map((level)=><option key={level} value={level}>{level}</option>)}</select></label><label className="checkbox"><input type="checkbox" checked={!!selected.competingHypothesis} onChange={(e)=>updateAnalytic("competingHypothesis", e.target.checked || undefined)}/> Competing hypothesis</label></>}</>:<p>Select a block or relationship.</p>}</div>
          <div className="rail-card"><h2>Evidence</h2>{selectedFacts.length?<ol>{selectedFacts.map((fact)=><li key={fact.id}><button className="evidence" disabled={fact.start<0} onClick={()=>chooseFact(fact.start,fact.end)}>{fact.text}</button></li>)}</ol>:<p>No direct source evidence attached.</p>}</div>
          <div className="rail-card terms-card"><h2>Terms</h2><div className="term-list">{document.terms.map((term)=><span key={term} title={term}>{term}</span>)}</div></div>
        </section>
      </section>
    </section>
  </main>;
}
