import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import { syncHolidaysForYear } from "../../services/holidays.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);

export interface HolidaysRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createHolidaysRouter(deps: HolidaysRouteDeps): Hono {
  const app = new Hono();

  app.post("/sync", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    try {
      const result = syncHolidaysForYear(
        deps.db,
        yearParsed.data,
        deps.config.raw.feiertage.bundesland,
      );
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Bundesland") || msg.includes("Keine Feiertage")) {
        return c.json({ error: "invalid_bundesland" }, 400);
      }
      throw err;
    }
  });

  return app;
}
