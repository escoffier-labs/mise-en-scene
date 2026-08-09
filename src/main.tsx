import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { EmbedView } from "./components/EmbedView";
import { isEmbedMode } from "./scene/share";
import "./index.css";

const embed = isEmbedMode(window.location);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {embed ? <EmbedView /> : <App />}
  </React.StrictMode>,
);
