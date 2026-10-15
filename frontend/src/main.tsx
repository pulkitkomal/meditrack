import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/theme";

// After a deploy, a cached page can request code chunks that no longer exist; reload once to pick up the new build.
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem("sehat-chunk-reload") || 0);
  if (Date.now() - last < 30_000) return;
  event.preventDefault();
  sessionStorage.setItem("sehat-chunk-reload", String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);