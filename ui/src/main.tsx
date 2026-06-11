import { QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n.ts";
import { YearProvider } from "./contexts/YearContext.tsx";
import { createQueryClient } from "./lib/query-client.ts";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");

const queryClient = createQueryClient(() => {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Suspense fallback={<div className="p-8">…</div>}>
      <QueryClientProvider client={queryClient}>
        <YearProvider>
          <App />
        </YearProvider>
      </QueryClientProvider>
    </Suspense>
  </React.StrictMode>,
);
