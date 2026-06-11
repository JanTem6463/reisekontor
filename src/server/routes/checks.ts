import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.ts";
import { checkYear } from "../../services/checks.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);

export interface ChecksRouteDeps {
  db: Db;
}

export function createChecksRouter(deps: ChecksRouteDeps): Hono {
  const app = new Hono();
  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    return c.json(checkYear(deps.db, yearParsed.data));
  });
  return app;
}
