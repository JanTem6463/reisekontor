import { describe, expect, it } from "vitest";
import { kuerzungCent } from "./pauschalen.ts";
import type { Meals, Rates } from "./types.ts";

const rates2026: Rates = {
  kleineCent: 1400,
  grosseCent: 2800,
  kuerzFruehstueckCent: 560,
  kuerzHauptCent: 1120,
  homeofficeProTagCent: 600,
  homeofficeMaxCent: 126000,
};

const noMeals: Meals = { fruehstueck: false, mittag: false, abend: false };

describe("kuerzungCent", () => {
  it("liefert 0 ohne gestellte Mahlzeit", () => {
    expect(kuerzungCent(noMeals, rates2026)).toBe(0);
  });

  it("zählt nur Frühstück", () => {
    expect(kuerzungCent({ ...noMeals, fruehstueck: true }, rates2026)).toBe(560);
  });

  it("zählt nur Mittag", () => {
    expect(kuerzungCent({ ...noMeals, mittag: true }, rates2026)).toBe(1120);
  });

  it("zählt nur Abend", () => {
    expect(kuerzungCent({ ...noMeals, abend: true }, rates2026)).toBe(1120);
  });

  it("addiert alle drei Mahlzeiten", () => {
    expect(
      kuerzungCent({ fruehstueck: true, mittag: true, abend: true }, rates2026),
    ).toBe(560 + 1120 + 1120);
  });
});
