import { useEffect, useMemo, useState } from "react";
import { SceneSvg } from "./SceneSvg";
import { layoutScene } from "../scene/layout";
import { decodeShareEnvelope, readShareTokenFromHash } from "../scene/share";
import { DEFAULT_SCENE_THEME, getSceneTheme, type SceneThemeId } from "../sceneStyles";
import type { SceneDocument } from "../scene/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; document: SceneDocument; theme: SceneThemeId };

/**
 * Minimal single-scene surface for iframe embeds: no editor chrome, no
 * localStorage. State comes only from the URL hash share envelope.
 */
export function EmbedView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const scene = useMemo(
    () => (state.status === "ready" ? layoutScene(state.document, state.document.view) : null),
    [state],
  );

  useEffect(() => {
    let cancelled = false;
    const token = readShareTokenFromHash(window.location.hash);
    if (!token) {
      setState({ status: "error", message: "Missing share payload in the URL hash." });
      return;
    }
    void decodeShareEnvelope(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error", message: result.error });
        return;
      }
      setState({
        status: "ready",
        document: result.value.document,
        theme: result.value.theme ?? DEFAULT_SCENE_THEME,
      });
    });
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return <main className="embed-shell" aria-busy="true"><p className="embed-status">Loading scene...</p></main>;
  }
  if (state.status === "error") {
    return <main className="embed-shell"><p className="embed-status" role="alert">{state.message}</p></main>;
  }
  const bg = getSceneTheme(state.theme).bg;
  return (
    <main className="embed-shell" style={{ background: bg }}>
      <div className="embed-stage">
        {scene ? <SceneSvg scene={scene} theme={state.theme} /> : null}
      </div>
    </main>
  );
}
