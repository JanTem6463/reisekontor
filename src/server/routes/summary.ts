import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import { computeSummary } from "../../services/summary.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);

export interface SummaryRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createSummaryRouter(deps: SummaryRouteDeps): Hono {
  const app = new Hono();
  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    try {
      return c.json(computeSummary(deps.db, yearParsed.data, deps.config));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Sätze für")) {
        return c.json({ error: "year_not_configured" }, 400);
      }
      throw err;
    }
  });
  return app;
}
