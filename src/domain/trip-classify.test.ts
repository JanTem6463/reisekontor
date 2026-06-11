import { describe, expect, it } from "vitest";
import { classifyTrip } from "./trip-classify.ts";
import type { TripInput } from "./types.ts";

describe("classifyTrip — 1 Kalendertag", () => {
  it("ohne Übernachtung → reise_eintaegig", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-04",
      uebernachtung: false,
    };
    expect(classifyTrip(input)).toEqual([{ date: "2026-03-04", type: "reise_eintaegig" }]);
  });

  it("mit Übernachtung → Error", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-04",
      uebernachtung: true,
    };
    expect(() => classifyTrip(input)).toThrow(/eintägig kann keine Übernachtung haben/);
  });
});

describe("classifyTrip — 2 Kalendertage (Mitternachtsregelung)", () => {
  it("ohne Übernachtung → eintägig auf Start-Datum, kein Eintrag für Folgetag", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-05",
      uebernachtung: false,
    };
    expect(classifyTrip(input)).toEqual([{ date: "2026-03-04", type: "reise_eintaegig" }]);
  });

  it("mit Übernachtung → Anreise + Abreise", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-05",
      uebernachtung: true,
    };
    expect(classifyTrip(input)).toEqual([
      { date: "2026-03-04", type: "reise_anreise" },
      { date: "2026-03-05", type: "reise_abreise" },
    ]);
  });
});

describe("classifyTrip — 3+ Kalendertage", () => {
  it("3 Tage mit Übernachtung → Anreise + 1 voller + Abreise", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-06",
      uebernachtung: true,
    };
    expect(classifyTrip(input)).toEqual([
      { date: "2026-03-04", type: "reise_anreise" },
      { date: "2026-03-05", type: "reise_voll" },
      { date: "2026-03-06", type: "reise_abreise" },
    ]);
  });

  it("7 Tage mit Übernachtung → Anreise + 5 volle + Abreise", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-10",
      uebernachtung: true,
    };
    const result = classifyTrip(input);
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ date: "2026-03-04", type: "reise_anreise" });
    expect(result[6]).toEqual({ date: "2026-03-10", type: "reise_abreise" });
    for (let i = 1; i <= 5; i++) {
      expect(result[i]?.type).toBe("reise_voll");
    }
  });

  it("3 Tage ohne Übernachtung → Error", () => {
    const input: TripInput = {
      startDate: "2026-03-04",
      endDate: "2026-03-06",
      uebernachtung: false,
    };
    expect(() => classifyTrip(input)).toThrow(/Mehrtägige Reise ohne Übernachtung/);
  });
});

describe("classifyTrip — Eingabevalidierung", () => {
  it("endDate vor startDate → Error", () => {
    const input: TripInput = {
      startDate: "2026-03-06",
      endDate: "2026-03-04",
      uebernachtung: true,
    };
    expect(() => classifyTrip(input)).toThrow(/endDate liegt vor startDate/);
  });

  it("Monatswechsel wird korrekt durchgezählt", () => {
    const input: TripInput = {
      startDate: "2026-01-31",
      endDate: "2026-02-02",
      uebernachtung: true,
    };
    expect(classifyTrip(input)).toEqual([
      { date: "2026-01-31", type: "reise_anreise" },
      { date: "2026-02-01", type: "reise_voll" },
      { date: "2026-02-02", type: "reise_abreise" },
    ]);
  });

  it("Schaltjahr 2024 — 28.02 → 29.02 → 01.03", () => {
    const input: TripInput = {
      startDate: "2024-02-28",
      endDate: "2024-03-01",
      uebernachtung: true,
    };
    expect(classifyTrip(input)).toEqual([
      { date: "2024-02-28", type: "reise_anreise" },
      { date: "2024-02-29", type: "reise_voll" },
      { date: "2024-03-01", type: "reise_abreise" },
    ]);
  });
});
