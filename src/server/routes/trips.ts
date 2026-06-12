import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.ts";
import type { DayOverride } from "../../services/trips.ts";
import * as tripsService from "../../services/trips.ts";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YearSchema = z.coerce.number().int().min(2020).max(2100);

const DayOverrideSchema = z.object({
  date: DateSchema,
  fruehstueck: z.boolean().optional(),
  mittag: z.boolean().optional(),
  abend: z.boolean().optional(),
  zuzahlungCent: z.number().int().nonnegative().optional(),
  homeoffice: z.boolean().optional(),
});

const TripBody = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  uebernachtung: z.boolean(),
  days: z.array(DayOverrideSchema).optional().default([]),
});

export interface TripsRouteDeps {
  db: Db;
}

function mapServiceError(err: unknown): { status: 400 | 409 } | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("eintägig kann keine Übernachtung") ||
    msg.includes("endDate liegt vor startDate") ||
    msg.includes("Mehrtägige Reise ohne Übernachtung")
  ) {
    return { status: 400 };
  }
  if (msg.includes("UNIQUE") || msg.includes("PRIMARY KEY")) {
    return { status: 409 };
  }
  return null;
}

export function createTripsRouter(deps: TripsRouteDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    return c.json(tripsService.listForYear(deps.db, yearParsed.data));
  });

  app.get("/:id", (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "invalid_query" }, 400);
    const trip = tripsService.get(deps.db, id);
    if (!trip) return c.json({ error: "not_found" }, 404);
    return c.json(trip);
  });

  app.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = TripBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    try {
      const cleanedDays = parsed.data.days.map((d) => {
        const o: DayOverride = { date: d.date };
        if (d.fruehstueck !== undefined) o.fruehstueck = d.fruehstueck;
        if (d.mittag !== undefined) o.mittag = d.mittag;
        if (d.abend !== undefined) o.abend = d.abend;
        if (d.zuzahlungCent !== undefined) o.zuzahlungCent = d.zuzahlungCent;
        if (d.homeoffice !== undefined) o.homeoffice = d.homeoffice;
        return o;
      });
      const result = tripsService.create(
        deps.db,
        {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          uebernachtung: parsed.data.uebernachtung,
        },
        cleanedDays,
      );
      return c.json(result, 201);
    } catch (err) {
      const mapped = mapServiceError(err);
      if (mapped?.status === 400) return c.json({ error: "invalid_trip_dates" }, 400);
      if (mapped?.status === 409) return c.json({ error: "date_conflict" }, 409);
      throw err;
    }
  });

  app.put("/:id", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "invalid_query" }, 400);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = TripBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    try {
      const cleanedDays = parsed.data.days.map((d) => {
        const o: DayOverride = { date: d.date };
        if (d.fruehstueck !== undefined) o.fruehstueck = d.fruehstueck;
        if (d.mittag !== undefined) o.mittag = d.mittag;
        if (d.abend !== undefined) o.abend = d.abend;
        if (d.zuzahlungCent !== undefined) o.zuzahlungCent = d.zuzahlungCent;
        if (d.homeoffice !== undefined) o.homeoffice = d.homeoffice;
        return o;
      });
      const result = tripsService.update(
        deps.db,
        id,
        {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          uebernachtung: parsed.data.uebernachtung,
        },
        cleanedDays,
      );
      if (!result) return c.json({ error: "not_found" }, 404);
      return c.json(result);
    } catch (err) {
      const mapped = mapServiceError(err);
      if (mapped?.status === 400) return c.json({ error: "invalid_trip_dates" }, 400);
      if (mapped?.status === 409) return c.json({ error: "date_conflict" }, 409);
      throw err;
    }
  });

  app.delete("/:id", (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "invalid_query" }, 400);
    const result = tripsService.deleteById(deps.db, id);
    if (!result.deleted) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
