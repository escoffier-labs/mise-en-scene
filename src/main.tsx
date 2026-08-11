import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import EmbedView from "./components/EmbedView";
import "./index.css";

const embed = new URLSearchParams(window.location.search).get("embed") === "1";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {embed ? <EmbedView /> : <App />}
  </React.StrictMode>,
);
