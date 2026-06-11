import { describe, expect, it } from "vitest";
import type { DayEntry } from "../domain/types.ts";
import { toDbDayInsert, toDomainDay } from "./mappers.ts";

describe("toDomainDay", () => {
  it("bündelt flache DB-Felder zu meals-Objekt", () => {
    const row = {
      date: "2026-03-15",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: 7,
      fruehstueck: true,
      mittag: false,
      abend: true,
      zuzahlungCent: 300,
    } as const;
    expect(toDomainDay(row)).toEqual({
      date: "2026-03-15",
      type: "reise_voll",
      homeoffice: false,
      meals: { fruehstueck: true, mittag: false, abend: true },
      zuzahlungCent: 300,
    });
  });
});

describe("toDbDayInsert", () => {
  it("zerlegt meals-Objekt in flache DB-Felder", () => {
    const domain: DayEntry = {
      date: "2026-03-15",
      type: "homeoffice",
      homeoffice: true,
      meals: { fruehstueck: false, mittag: true, abend: false },
      zuzahlungCent: 0,
    };
    expect(toDbDayInsert(domain, 2026, null)).toEqual({
      date: "2026-03-15",
      year: 2026,
      type: "homeoffice",
      homeoffice: true,
      tripId: null,
      fruehstueck: false,
      mittag: true,
      abend: false,
      zuzahlungCent: 0,
    });
  });

  it("nimmt tripId an", () => {
    const domain: DayEntry = {
      date: "2026-04-01",
      type: "reise_anreise",
      homeoffice: true,
      meals: { fruehstueck: false, mittag: false, abend: false },
      zuzahlungCent: 0,
    };
    const inserted = toDbDayInsert(domain, 2026, 42);
    expect(inserted.tripId).toBe(42);
  });
});
