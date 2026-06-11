import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import {
  type UpdateSettingsBody,
  getEffectiveSettings,
  updateSettings,
} from "../../services/settings.ts";

const StandardwocheSchema = z.object({
  mo: z.boolean(),
  di: z.boolean(),
  mi: z.boolean(),
  do: z.boolean(),
  fr: z.boolean(),
  sa: z.boolean(),
  so: z.boolean(),
});

const UpdateBody = z.object({
  bundesland: z.string().length(2).optional(),
  standardwoche: StandardwocheSchema.optional(),
});

export interface SettingsRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createSettingsRouter(deps: SettingsRouteDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json(getEffectiveSettings(deps.db, deps.config));
  });

  app.put("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    const updateBody: UpdateSettingsBody = {};
    if (parsed.data.bundesland !== undefined) updateBody.bundesland = parsed.data.bundesland;
    if (parsed.data.standardwoche !== undefined)
      updateBody.standardwoche = parsed.data.standardwoche;
    try {
      const result = updateSettings(deps.db, updateBody, deps.config);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Bundesland")) {
        return c.json({ error: "invalid_bundesland_in_settings" }, 400);
      }
      if (msg.includes("standardwoche")) {
        return c.json({ error: "invalid_standardwoche" }, 400);
      }
      throw err;
    }
  });

  return app;
}
