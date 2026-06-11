import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n.ts";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Suspense fallback={<div className="p-8">…</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
