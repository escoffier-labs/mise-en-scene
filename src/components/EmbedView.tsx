import { useEffect, useMemo, useState } from "react";
import { layoutScene } from "../scene/layout";
import { bindShareHash, type ShareHashState } from "../scene/share";
import type { SceneThemeId } from "../sceneStyles";
import { SceneSvg } from "./SceneSvg";

export default function EmbedView() {
  const [state, setState] = useState<ShareHashState>({ status: "loading" });

  useEffect(() => {
    const binding = bindShareHash({
      getHash: () => window.location.hash,
      onChange: setState,
      addEventListener: (_type, handler) => window.addEventListener("hashchange", handler),
      removeEventListener: (_type, handler) => window.removeEventListener("hashchange", handler),
    });
    return () => binding.dispose();
  }, []);

  const scene = useMemo(() => {
    if (state.status !== "ready") return null;
    return layoutScene(state.document, state.document.view);
  }, [state]);

  if (state.status === "error" || state.status === "idle") {
    const message = state.status === "error" ? state.error : "Invalid shared scene link";
    return (
      <main className="embed-shell" role="alert">
        <p className="embed-status">{message}</p>
      </main>
    );
  }

  if (state.status !== "ready" || !scene) {
    return (
      <main className="embed-shell">
        <p className="embed-status">Loading shared scene...</p>
      </main>
    );
  }

  const theme: SceneThemeId = state.theme;
  return (
    <main className="embed-shell">
      <div className="embed-stage">
        <SceneSvg scene={scene} theme={theme} />
      </div>
    </main>
  );
}
