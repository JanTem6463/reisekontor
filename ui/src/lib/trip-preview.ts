import type { DayType } from "@/lib/api";

export interface PreviewDay {
  date: string;
  type: DayType;
}

function addDaysISO(startISO: string, n: number): string {
  const d = new Date(`${startISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(startISO: string, endISO: string): number {
  const a = new Date(`${startISO}T00:00:00Z`).getTime();
  const b = new Date(`${endISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Mirror of `classifyTrip` from src/domain/trip-classify.ts (backend).
 * Kept in sync manually — both files are small + deterministic.
 * Backend is source of truth: on conflict, prefer backend behavior.
 */
export function classifyTripPreview(
  startDate: string,
  endDate: string,
  uebernachtung: boolean,
): PreviewDay[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return null;
  }
  const n = daysBetweenInclusive(startDate, endDate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) {
    if (uebernachtung) return null;
    return [{ date: startDate, type: "reise_eintaegig" }];
  }
  if (n === 2 && !uebernachtung) {
    return [{ date: startDate, type: "reise_eintaegig" }];
  }
  if (!uebernachtung) return null;
  const rows: PreviewDay[] = [];
  for (let i = 0; i < n; i++) {
    const d = addDaysISO(startDate, i);
    if (i === 0) rows.push({ date: d, type: "reise_anreise" });
    else if (i === n - 1) rows.push({ date: d, type: "reise_abreise" });
    else rows.push({ date: d, type: "reise_voll" });
  }
  return rows;
}
