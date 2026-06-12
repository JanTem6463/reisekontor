import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dayEntries, trips } from "../db/schema.ts";
import { classifyTrip } from "../domain/trip-classify.ts";
import type { TripInput } from "../domain/types.ts";

type DbDayRow = typeof dayEntries.$inferSelect;
type DbTripRow = typeof trips.$inferSelect;

export interface TripWithDays {
  trip: DbTripRow;
  days: DbDayRow[];
}

export interface DayOverride {
  date: string;
  fruehstueck?: boolean;
  mittag?: boolean;
  abend?: boolean;
  zuzahlungCent?: number;
  homeoffice?: boolean;
}

export function listForYear(db: Db, year: number): TripWithDays[] {
  const tripRows = db.select().from(trips).where(eq(trips.year, year)).all();
  return tripRows.map((trip) => ({
    trip,
    days: db.select().from(dayEntries).where(eq(dayEntries.tripId, trip.id)).all(),
  }));
}

export function get(db: Db, id: number): TripWithDays | null {
  const tripRows = db.select().from(trips).where(eq(trips.id, id)).all();
  const trip = tripRows[0];
  if (!trip) return null;
  return {
    trip,
    days: db.select().from(dayEntries).where(eq(dayEntries.tripId, trip.id)).all(),
  };
}

export function create(db: Db, input: TripInput, dayOverrides: DayOverride[] = []): TripWithDays {
  const classified = classifyTrip(input); // wirft bei ungültigen Eingaben
  const year = Number.parseInt(input.startDate.slice(0, 4), 10);
  const overrideMap = new Map<string, DayOverride>(dayOverrides.map((o) => [o.date, o]));

  return db.transaction((tx) => {
    const [insertedTrip] = tx
      .insert(trips)
      .values({
        year,
        startDate: input.startDate,
        endDate: input.endDate,
        uebernachtung: input.uebernachtung,
      })
      .returning()
      .all();
    if (!insertedTrip) throw new Error("Trip-Insert lieferte keine Row zurück");

    const dayInserts = classified.map((c) => {
      const ov = overrideMap.get(c.date);
      return {
        date: c.date,
        year: Number.parseInt(c.date.slice(0, 4), 10),
        type: c.type,
        homeoffice: ov?.homeoffice ?? false,
        tripId: insertedTrip.id,
        fruehstueck: ov?.fruehstueck ?? false,
        mittag: ov?.mittag ?? false,
        abend: ov?.abend ?? false,
        zuzahlungCent: ov?.zuzahlungCent ?? 0,
      };
    });
    const insertedDays = tx.insert(dayEntries).values(dayInserts).returning().all();

    return { trip: insertedTrip, days: insertedDays };
  });
}

export function update(
  db: Db,
  id: number,
  input: TripInput,
  dayOverrides: DayOverride[] = [],
): TripWithDays | null {
  const existing = get(db, id);
  if (!existing) return null;

  const classified = classifyTrip(input); // wirft bei ungültiger Eingabe
  const year = Number.parseInt(input.startDate.slice(0, 4), 10);
  const overrideMap = new Map<string, DayOverride>(dayOverrides.map((o) => [o.date, o]));

  return db.transaction((tx) => {
    // Hart-Reset: alte day_entries löschen
    tx.delete(dayEntries).where(eq(dayEntries.tripId, id)).run();

    // Trip-Row aktualisieren
    const [updatedTrip] = tx
      .update(trips)
      .set({
        year,
        startDate: input.startDate,
        endDate: input.endDate,
        uebernachtung: input.uebernachtung,
      })
      .where(eq(trips.id, id))
      .returning()
      .all();
    if (!updatedTrip) throw new Error("Trip-Update lieferte keine Row zurück");

    const dayInserts = classified.map((c) => {
      const ov = overrideMap.get(c.date);
      return {
        date: c.date,
        year: Number.parseInt(c.date.slice(0, 4), 10),
        type: c.type,
        homeoffice: ov?.homeoffice ?? false,
        tripId: id,
        fruehstueck: ov?.fruehstueck ?? false,
        mittag: ov?.mittag ?? false,
        abend: ov?.abend ?? false,
        zuzahlungCent: ov?.zuzahlungCent ?? 0,
      };
    });
    const insertedDays = tx.insert(dayEntries).values(dayInserts).returning().all();

    return { trip: updatedTrip, days: insertedDays };
  });
}

export function deleteById(db: Db, id: number): { deleted: boolean } {
  return db.transaction((tx) => {
    tx.delete(dayEntries).where(eq(dayEntries.tripId, id)).run();
    const result = tx.delete(trips).where(eq(trips.id, id)).run();
    return { deleted: result.changes > 0 };
  });
}
