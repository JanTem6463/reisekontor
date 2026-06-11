import type { Meals, Rates } from "./types.ts";

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
