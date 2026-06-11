import type { dayEntries } from "../db/schema.ts";
import type { DayEntry, DayType } from "../domain/types.ts";

type DbDayRow = typeof dayEntries.$inferSelect;
type DbDayInsert = typeof dayEntries.$inferInsert;

export function toDomainDay(row: DbDayRow): DayEntry {
  return {
    date: row.date,
    type: row.type as DayType,
    homeoffice: row.homeoffice,
    meals: {
      fruehstueck: row.fruehstueck,
      mittag: row.mittag,
      abend: row.abend,
    },
    zuzahlungCent: row.zuzahlungCent,
  };
}

export function toDbDayInsert(domain: DayEntry, year: number, tripId: number | null): DbDayInsert {
  return {
    date: domain.date,
    year,
    type: domain.type,
    homeoffice: domain.homeoffice,
    tripId,
    fruehstueck: domain.meals.fruehstueck,
    mittag: domain.meals.mittag,
    abend: domain.meals.abend,
    zuzahlungCent: domain.zuzahlungCent,
  };
}
