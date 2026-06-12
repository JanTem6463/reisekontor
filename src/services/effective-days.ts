import type { dayEntries } from "../db/schema.ts";
import type { DayType } from "../domain/types.ts";
import type { Standardwoche } from "./settings.ts";

type DbDayRow = typeof dayEntries.$inferSelect;

const WEEKDAY_KEYS = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;
type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

function weekdayKey(dateIso: string): WeekdayKey {
  // UTC, weil Datumsstrings ISO YYYY-MM-DD ohne Timezone sind.
  const d = new Date(`${dateIso}T00:00:00Z`);
  return WEEKDAY_KEYS[d.getUTCDay()] as WeekdayKey;
}

function* iterYearDates(year: number): Generator<string> {
  let cur = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  while (cur < end) {
    yield new Date(cur).toISOString().slice(0, 10);
    cur += 86400000;
  }
}

function rowIsExplicitHomeoffice(row: DbDayRow): boolean {
  const t = row.type as DayType;
  if (t === "homeoffice") return true;
  if ((t === "reise_anreise" || t === "reise_abreise") && row.homeoffice) return true;
  return false;
}

/**
 * Effektive Homeoffice-Tage eines Jahres.
 *
 * Pro Kalendertag gilt:
 * - Existiert ein DB-Eintrag, zählt dessen Typ (homeoffice ja; Anreise/Abreise nur wenn
 *   homeoffice-Combo gesetzt). Alle anderen Typen (Büro, Urlaub, Krankheit, Feiertag,
 *   reise_voll, reise_eintaegig, Anreise/Abreise ohne Combo) sperren den Tag.
 * - Existiert kein DB-Eintrag, füllt die Standardwoche: passt der Wochentag, gilt
 *   der Tag als implizites Homeoffice.
 *
 * Siehe Impl-Dok §5.2 FA-5/FA-6.
 */
export function computeEffectiveHomeofficeDates(
  year: number,
  dbDayRows: DbDayRow[],
  standardwoche: Standardwoche,
): string[] {
  const byDate = new Map<string, DbDayRow>();
  for (const r of dbDayRows) byDate.set(r.date, r);

  const result: string[] = [];
  for (const date of iterYearDates(year)) {
    const row = byDate.get(date);
    if (row) {
      if (rowIsExplicitHomeoffice(row)) result.push(date);
      continue;
    }
    if (standardwoche[weekdayKey(date)]) result.push(date);
  }
  return result;
}

export function homeofficeBetragCent(
  count: number,
  ratesProTagCent: number,
  ratesMaxCent: number,
): number {
  return Math.min(count * ratesProTagCent, ratesMaxCent);
}
