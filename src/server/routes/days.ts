import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.ts";
import * as daysService from "../../services/days.ts";

const DayTypeSchema = z.enum([
  "homeoffice",
  "buero",
  "reise_anreise",
  "reise_voll",
  "reise_abreise",
  "reise_eintaegig",
  "urlaub",
  "krankheit",
  "feiertag",
]);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YearSchema = z.coerce.number().int().min(2020).max(2100);

const PutDayBody = z.object({
  type: DayTypeSchema,
  homeoffice: z.boolean().optional().default(false),
  tripId: z.number().int().nullable().optional().default(null),
  meals: z
    .object({
      fruehstueck: z.boolean().optional().default(false),
      mittag: z.boolean().optional().default(false),
      abend: z.boolean().optional().default(false),
    })
    .optional()
    .default({ fruehstueck: false, mittag: false, abend: false }),
  zuzahlungCent: z.number().int().nonnegative().optional().default(0),
});

const REISE_TYPES = new Set(["reise_anreise", "reise_voll", "reise_abreise", "reise_eintaegig"]);

export interface DaysRouteDeps {
  db: Db;
}

export function createDaysRouter(deps: DaysRouteDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    const rows = daysService.listForYear(deps.db, yearParsed.data);
    return c.json(rows);
  });

  app.put("/:date", async (c) => {
    const date = c.req.param("date");
    if (!DateSchema.safeParse(date).success) {
      return c.json({ error: "invalid_query" }, 400);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = PutDayBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);

    const existing = daysService.get(deps.db, date);

    // Regel: neuer Eintrag mit Reise-Typ → 400
    if (!existing && REISE_TYPES.has(parsed.data.type)) {
      return c.json({ error: "reise_type_via_trips" }, 400);
    }

    // Regel: existing Reise-Tag, Type-Change verboten
    if (existing && REISE_TYPES.has(existing.type) && parsed.data.type !== existing.type) {
      return c.json({ error: "type_locked_for_trip_day" }, 400);
    }

    // Regel: existing mit tripId, body.tripId muss matchen
    if (existing && existing.tripId !== null) {
      if (parsed.data.tripId !== existing.tripId) {
        return c.json({ error: "trip_id_locked" }, 400);
      }
    }

    const year = Number.parseInt(date.slice(0, 4), 10);
    const result = daysService.upsert(deps.db, {
      date,
      year,
      type: parsed.data.type,
      homeoffice: parsed.data.homeoffice,
      tripId: parsed.data.tripId,
      fruehstueck: parsed.data.meals.fruehstueck,
      mittag: parsed.data.meals.mittag,
      abend: parsed.data.meals.abend,
      zuzahlungCent: parsed.data.zuzahlungCent,
    });
    return c.json({ ok: true, created: result.created });
  });

  app.delete("/:date", (c) => {
    const date = c.req.param("date");
    if (!DateSchema.safeParse(date).success) {
      return c.json({ error: "invalid_query" }, 400);
    }
    const existing = daysService.get(deps.db, date);
    if (existing && REISE_TYPES.has(existing.type)) {
      return c.json({ error: "reise_day_via_trip" }, 400);
    }
    const result = daysService.deleteByDate(deps.db, date);
    if (!result.deleted) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
