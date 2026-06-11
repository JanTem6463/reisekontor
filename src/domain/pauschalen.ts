import type { DayEntry, Meals, Rates } from "./types.ts";

/**
 * Summe der Mahlzeitenkürzungen in Cent.
 * Kürzungssätze stets aus dem vollen Tagessatz (28 €) — auch bei der kleinen Pauschale.
 */
export function kuerzungCent(meals: Meals, rates: Rates): number {
  return (
    (meals.fruehstueck ? rates.kuerzFruehstueckCent : 0) +
    (meals.mittag ? rates.kuerzHauptCent : 0) +
    (meals.abend ? rates.kuerzHauptCent : 0)
  );
}

/**
 * Verpflegungspauschale eines Tages in Cent.
 * Nicht-Reisetage → 0. Kürzungs-Floor bei 0 (nie negativ). Zuzahlung kürzt
 * die Mahlzeitenkürzung, kann sie aber nicht negativ machen.
 */
export function verpflegungProTagCent(day: DayEntry, rates: Rates): number {
  const base =
    day.type === "reise_voll"
      ? rates.grosseCent
      : day.type === "reise_anreise" ||
          day.type === "reise_abreise" ||
          day.type === "reise_eintaegig"
        ? rates.kleineCent
        : 0;
  if (base === 0) return 0;
  const kuerz = Math.max(kuerzungCent(day.meals, rates) - day.zuzahlungCent, 0);
  return Math.max(base - kuerz, 0);
}

/**
 * Anzahl der Homeoffice-Tage. Urlaub, Krankheit, Feiertag, Büro
 * und reise_voll/reise_eintaegig zählen NIE.
 */
export function homeofficeTage(days: DayEntry[]): number {
  return days.filter(
    (d) =>
      d.type === "homeoffice" ||
      (d.homeoffice && (d.type === "reise_anreise" || d.type === "reise_abreise")),
  ).length;
}

/**
 * Homeoffice-Pauschale in Cent. Gedeckelt auf homeofficeMaxCent
 * (in 2026: 126.000 Cent = 1.260 € = 210 × 600).
 */
export function homeofficePauschaleCent(days: DayEntry[], rates: Rates): number {
  return Math.min(homeofficeTage(days) * rates.homeofficeProTagCent, rates.homeofficeMaxCent);
}
