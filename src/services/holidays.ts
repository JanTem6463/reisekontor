import Holidays from "date-holidays";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dayEntries } from "../db/schema.ts";

export interface HolidaysSyncResult {
  year: number;
  bundesland: string;
  created: number;
  skipped: Array<{ date: string; existingType: string }>;
}

export function syncHolidaysForYear(db: Db, year: number, bundesland: string): HolidaysSyncResult {
  const validStates = new Holidays().getStates("DE");
  if (!validStates || !Object.keys(validStates).includes(bundesland)) {
    throw new Error(`Ungültiges Bundesland: DE/${bundesland}`);
  }
  const hd = new Holidays("DE", bundesland);
  const allHolidays = hd.getHolidays(year);
  if (!Array.isArray(allHolidays) || allHolidays.length === 0) {
    throw new Error(`Keine Feiertage für DE/${bundesland} ${year} gefunden`);
  }
  const publicHolidays = allHolidays.filter((h) => h.type === "public");

  return db.transaction((tx) => {
    tx.delete(dayEntries)
      .where(and(eq(dayEntries.year, year), eq(dayEntries.type, "feiertag")))
      .run();

    let created = 0;
    const skipped: Array<{ date: string; existingType: string }> = [];

    for (const holiday of publicHolidays) {
      const date = holiday.date.slice(0, 10);
      const existingRows = tx.select().from(dayEntries).where(eq(dayEntries.date, date)).all();
      const existing = existingRows[0] ?? null;
      if (existing) {
        skipped.push({ date, existingType: existing.type });
        continue;
      }
      tx.insert(dayEntries)
        .values({
          date,
          year,
          type: "feiertag",
          homeoffice: false,
          tripId: null,
          fruehstueck: false,
          mittag: false,
          abend: false,
          zuzahlungCent: 0,
        })
        .run();
      created++;
    }

    return { year, bundesland, created, skipped };
  });
}
