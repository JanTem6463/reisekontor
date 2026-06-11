import type { ClassifiedDay, TripInput } from "./types.ts";

/**
 * Klassifiziert die Tage einer Reise:
 *  - eintägig (1 Kalendertag, keine Übernachtung): nur reise_eintaegig.
 *  - eintägig über zwei Kalendertage (Mitternachtsregelung): genau eine
 *    kleine Pauschale, zugeordnet dem Start-Datum. Der zweite Kalendertag
 *    erhält KEINEN Reise-Eintrag (siehe docs/architecture.md).
 *  - mehrtägig mit Übernachtung: Anreise + n-2 volle Tage + Abreise.
 *
 * Wirft Error bei unzulässigen Eingaben (siehe specs/workflows/tagestyp.mmd).
 */
export function classifyTrip(input: TripInput): ClassifiedDay[] {
  const start = parseIso(input.startDate);
  const end = parseIso(input.endDate);
  const days = daysBetweenInclusive(start, end);

  if (days <= 0) {
    throw new Error("Ungültige Reise: endDate liegt vor startDate");
  }

  if (days === 1) {
    if (input.uebernachtung) {
      throw new Error("Ungültige Reise: eintägig kann keine Übernachtung haben");
    }
    return [{ date: input.startDate, type: "reise_eintaegig" }];
  }

  if (days === 2 && !input.uebernachtung) {
    // Mitternachtsregelung: eine kleine Pauschale auf Start-Datum
    return [{ date: input.startDate, type: "reise_eintaegig" }];
  }

  if (!input.uebernachtung) {
    throw new Error("Ungültige Reise: Mehrtägige Reise ohne Übernachtung nicht möglich");
  }

  const result: ClassifiedDay[] = [];
  for (let i = 0; i < days; i++) {
    const dateStr = formatIso(addDays(start, i));
    if (i === 0) {
      result.push({ date: dateStr, type: "reise_anreise" });
    } else if (i === days - 1) {
      result.push({ date: dateStr, type: "reise_abreise" });
    } else {
      result.push({ date: dateStr, type: "reise_voll" });
    }
  }
  return result;
}

function parseIso(s: string): Date {
  // ISO YYYY-MM-DD als UTC-Mitternacht — vermeidet TZ-Drift bei Tageszählung.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Ungültiges ISO-Datum: ${s}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function daysBetweenInclusive(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}
