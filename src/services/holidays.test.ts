import { beforeEach, describe, expect, it } from "vitest";
import { type Db, createDb } from "../db/client.ts";
import * as daysService from "./days.ts";
import { syncHolidaysForYear } from "./holidays.ts";

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("syncHolidaysForYear — NI 2026", () => {
  it("leerer DB → mindestens 9 Feiertage erzeugt (NI hat 9 gesetzliche)", () => {
    const result = syncHolidaysForYear(db, 2026, "NI");
    expect(result.year).toBe(2026);
    expect(result.bundesland).toBe("NI");
    expect(result.created).toBeGreaterThanOrEqual(9);
    expect(result.skipped).toEqual([]);
    const days = daysService.listForYear(db, 2026);
    expect(days.filter((d) => d.type === "feiertag").length).toBeGreaterThanOrEqual(9);
  });

  it("idempotent: zweiter Sync → keine doppelten Einträge", () => {
    syncHolidaysForYear(db, 2026, "NI");
    const before = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag").length;
    const result = syncHolidaysForYear(db, 2026, "NI");
    const after = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag").length;
    expect(after).toBe(before);
    expect(result.created).toBe(before);
    expect(result.skipped).toEqual([]);
  });

  it("User-Override: existing urlaub auf 01.05. → skipped", () => {
    daysService.upsert(db, {
      date: "2026-05-01",
      year: 2026,
      type: "urlaub",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const result = syncHolidaysForYear(db, 2026, "NI");
    expect(result.skipped.length).toBeGreaterThanOrEqual(1);
    const may1Skip = result.skipped.find((s) => s.date === "2026-05-01");
    expect(may1Skip?.existingType).toBe("urlaub");
    const may1Day = daysService.get(db, "2026-05-01");
    expect(may1Day?.type).toBe("urlaub");
  });

  it("User-Override mit reise_voll → skipped, Reise bleibt", () => {
    daysService.upsert(db, {
      date: "2026-12-25",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const result = syncHolidaysForYear(db, 2026, "NI");
    expect(result.skipped.some((s) => s.date === "2026-12-25")).toBe(true);
    expect(daysService.get(db, "2026-12-25")?.type).toBe("reise_voll");
  });

  it("ungültiges Bundesland → wirft", () => {
    expect(() => syncHolidaysForYear(db, 2026, "XX")).toThrow();
  });
});

describe("syncHolidaysForYear — Bundesland-Wechsel-Cleanup", () => {
  it("alte feiertag-Einträge werden vor dem Sync entfernt", () => {
    syncHolidaysForYear(db, 2026, "NI");
    const niCount = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag").length;
    expect(niCount).toBeGreaterThanOrEqual(9);

    const byResult = syncHolidaysForYear(db, 2026, "BY");
    const byDays = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag");
    expect(byDays.length).toBe(byResult.created);
  });
});
