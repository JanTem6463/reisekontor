import { describe, expect, it } from "vitest";
import { kuerzungCent, verpflegungProTagCent } from "./pauschalen.ts";
import type { DayEntry, Meals, Rates } from "./types.ts";

const rates2026: Rates = {
  kleineCent: 1400,
  grosseCent: 2800,
  kuerzFruehstueckCent: 560,
  kuerzHauptCent: 1120,
  homeofficeProTagCent: 600,
  homeofficeMaxCent: 126000,
};

const noMeals: Meals = { fruehstueck: false, mittag: false, abend: false };

function entry(overrides: Partial<DayEntry>): DayEntry {
  return {
    date: "2026-03-04",
    type: "homeoffice",
    homeoffice: false,
    meals: { fruehstueck: false, mittag: false, abend: false },
    zuzahlungCent: 0,
    ...overrides,
  };
}

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

describe("verpflegungProTagCent — §14.1 Pflichtfälle", () => {
  it("Anreisetag ohne gestellte Mahlzeit → 14,00 €", () => {
    const d = entry({ type: "reise_anreise" });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1400);
  });

  it("Voller Tag, Abendessen gestellt → 28 − 11,20 = 16,80 €", () => {
    const d = entry({ type: "reise_voll", meals: { fruehstueck: false, mittag: false, abend: true } });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1680);
  });

  it("Voller Tag, Frühstück + Abendessen gestellt → 28 − 16,80 = 11,20 €", () => {
    const d = entry({ type: "reise_voll", meals: { fruehstueck: true, mittag: false, abend: true } });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1120);
  });

  it("Anreisetag, Mittag + Abend gestellt → max(14 − 22,40, 0) = 0", () => {
    const d = entry({ type: "reise_anreise", meals: { fruehstueck: false, mittag: true, abend: true } });
    expect(verpflegungProTagCent(d, rates2026)).toBe(0);
  });

  it("Eintägige Reise > 8 h, keine Mahlzeit → 14,00 €", () => {
    const d = entry({ type: "reise_eintaegig" });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1400);
  });

  it("Zuzahlung 3,00 € bei gestelltem Mittag (voller Tag) → 28 − (11,20 − 3,00) = 19,80 €", () => {
    const d = entry({
      type: "reise_voll",
      meals: { fruehstueck: false, mittag: true, abend: false },
      zuzahlungCent: 300,
    });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1980);
  });

  it("Abreisetag ohne Mahlzeit → 14,00 €", () => {
    const d = entry({ type: "reise_abreise" });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1400);
  });
});

describe("verpflegungProTagCent — Nicht-Reisetage liefern 0", () => {
  it("homeoffice → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "homeoffice" }), rates2026)).toBe(0);
  });
  it("buero → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "buero" }), rates2026)).toBe(0);
  });
  it("urlaub → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "urlaub" }), rates2026)).toBe(0);
  });
  it("krankheit → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "krankheit" }), rates2026)).toBe(0);
  });
  it("feiertag → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "feiertag" }), rates2026)).toBe(0);
  });
});

describe("verpflegungProTagCent — Edge Cases", () => {
  it("Zuzahlung größer als Kürzung gibt keinen Bonus (Floor bei kuerzungCent)", () => {
    const d = entry({
      type: "reise_voll",
      meals: { fruehstueck: false, mittag: true, abend: false },
      zuzahlungCent: 5000,
    });
    expect(verpflegungProTagCent(d, rates2026)).toBe(2800);
  });

  it("Kürzung über Basis hinaus → Floor bei 0, nie negativ", () => {
    const d = entry({
      type: "reise_eintaegig",
      meals: { fruehstueck: true, mittag: true, abend: true },
    });
    expect(verpflegungProTagCent(d, rates2026)).toBe(0);
  });
});
