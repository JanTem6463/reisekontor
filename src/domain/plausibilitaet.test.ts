import { describe, expect, it } from "vitest";
import { checkAll } from "./plausibilitaet.ts";
import type { DayEntry } from "./types.ts";

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

describe("checkAll — DOPPEL_HO_REISE_VOLL", () => {
  it("findet reise_voll-Tag mit homeoffice=true", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_voll", homeoffice: true })];
    const result = checkAll(days);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code: "DOPPEL_HO_REISE_VOLL",
      date: "2026-03-05",
      schwere: "warnung",
    });
  });

  it("reise_voll ohne homeoffice → kein Hinweis", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_voll", homeoffice: false })];
    expect(checkAll(days)).toEqual([]);
  });
});

describe("checkAll — EINTAEGIG_8H_BESTAETIGEN", () => {
  it("findet jeden reise_eintaegig-Tag", () => {
    const days = [
      entry({ date: "2026-03-05", type: "reise_eintaegig" }),
      entry({ date: "2026-03-06", type: "reise_eintaegig" }),
    ];
    const result = checkAll(days);
    const eintaegig = result.filter((h) => h.code === "EINTAEGIG_8H_BESTAETIGEN");
    expect(eintaegig).toHaveLength(2);
    expect(eintaegig[0]?.schwere).toBe("hinweis");
  });
});

describe("checkAll — HO_KONFLIKT_ENTFERNUNG", () => {
  it("findet jeden homeoffice-Tag", () => {
    const days = [
      entry({ date: "2026-03-05", type: "homeoffice" }),
      entry({ date: "2026-03-06", type: "homeoffice" }),
    ];
    const result = checkAll(days);
    const konflikt = result.filter((h) => h.code === "HO_KONFLIKT_ENTFERNUNG");
    expect(konflikt).toHaveLength(2);
    expect(konflikt[0]?.schwere).toBe("hinweis");
  });

  it("Anreise mit homeoffice=true (Kombi-Tag) löst HO_KONFLIKT aus", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_anreise", homeoffice: true })];
    const result = checkAll(days);
    expect(result.some((h) => h.code === "HO_KONFLIKT_ENTFERNUNG")).toBe(true);
  });
});

describe("checkAll — gemischt", () => {
  it("liefert verschiedene Codes für verschiedene Tage in einer Liste", () => {
    const days = [
      entry({ date: "2026-03-05", type: "reise_voll", homeoffice: true }),
      entry({ date: "2026-03-06", type: "homeoffice" }),
      entry({ date: "2026-03-07", type: "reise_eintaegig" }),
    ];
    const result = checkAll(days);
    expect(result).toHaveLength(3);
    expect(result.map((h) => h.code).sort()).toEqual([
      "DOPPEL_HO_REISE_VOLL",
      "EINTAEGIG_8H_BESTAETIGEN",
      "HO_KONFLIKT_ENTFERNUNG",
    ]);
  });

  it("reise_voll + homeoffice=true liefert NUR DOPPEL_HO_REISE_VOLL, nicht zusätzlich HO_KONFLIKT", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_voll", homeoffice: true })];
    const result = checkAll(days);
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("DOPPEL_HO_REISE_VOLL");
  });

  it("leere Eingabe → leere Liste", () => {
    expect(checkAll([])).toEqual([]);
  });
});
