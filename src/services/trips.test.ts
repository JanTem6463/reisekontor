import { beforeEach, describe, expect, it } from "vitest";
import { type Db, createDb } from "../db/client.ts";
import * as daysService from "./days.ts";
import * as tripsService from "./trips.ts";

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("Trips Service — create", () => {
  it("3-Tages-Reise mit Übernachtung erzeugt Anreise + Voll + Abreise", () => {
    const result = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    expect(result.trip.year).toBe(2026);
    expect(result.trip.uebernachtung).toBe(true);
    expect(result.days).toHaveLength(3);
    expect(result.days.map((d) => d.type)).toEqual([
      "reise_anreise",
      "reise_voll",
      "reise_abreise",
    ]);
    expect(result.days.every((d) => d.tripId === result.trip.id)).toBe(true);
  });

  it("eintägige Reise ohne Übernachtung erzeugt 1 Day-Entry", () => {
    const result = tripsService.create(db, {
      startDate: "2026-05-10",
      endDate: "2026-05-10",
      uebernachtung: false,
    });
    expect(result.days).toHaveLength(1);
    expect(result.days[0]?.type).toBe("reise_eintaegig");
  });

  it("ungültige TripInput → wirft", () => {
    expect(() =>
      tripsService.create(db, {
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        uebernachtung: true,
      }),
    ).toThrow(/eintägig kann keine Übernachtung haben/);
  });

  it("Date-Konflikt mit existierendem Day-Entry → wirft, kein Trip persistiert", () => {
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "homeoffice",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    expect(() =>
      tripsService.create(db, {
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        uebernachtung: true,
      }),
    ).toThrow();
    expect(tripsService.listForYear(db, 2026)).toHaveLength(0);
  });
});

describe("Trips Service — update (Hart-Reset)", () => {
  it("ändert Zeitraum und ersetzt Day-Entries komplett", () => {
    const original = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    // Manuelle Mahlzeit setzen
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: original.trip.id,
      fruehstueck: false,
      mittag: true,
      abend: false,
      zuzahlungCent: 0,
    });

    const updated = tripsService.update(db, original.trip.id, {
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      uebernachtung: true,
    });
    expect(updated?.days).toHaveLength(5);
    // Manuelle Mahlzeit weg (Hart-Reset)
    const apr2 = daysService.get(db, "2026-04-02");
    expect(apr2?.mittag).toBe(false);
  });

  it("liefert null bei nicht existierender ID", () => {
    expect(
      tripsService.update(db, 9999, {
        startDate: "2026-04-01",
        endDate: "2026-04-02",
        uebernachtung: true,
      }),
    ).toBeNull();
  });
});

describe("Trips Service — delete + list + get", () => {
  it("delete entfernt Trip + alle Day-Entries", () => {
    const trip = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    expect(tripsService.deleteById(db, trip.trip.id)).toEqual({ deleted: true });
    expect(tripsService.listForYear(db, 2026)).toEqual([]);
    expect(daysService.listForYear(db, 2026)).toEqual([]);
  });

  it("delete auf nicht existierender ID → deleted: false", () => {
    expect(tripsService.deleteById(db, 9999)).toEqual({ deleted: false });
  });

  it("listForYear gruppiert trips mit ihren days", () => {
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      uebernachtung: true,
    });
    tripsService.create(db, {
      startDate: "2026-05-10",
      endDate: "2026-05-10",
      uebernachtung: false,
    });
    const list = tripsService.listForYear(db, 2026);
    expect(list).toHaveLength(2);
    expect(list[0]?.days).toHaveLength(2);
    expect(list[1]?.days).toHaveLength(1);
  });

  it("get liefert TripWithDays für existierende ID", () => {
    const created = tripsService.create(db, {
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      uebernachtung: true,
    });
    const fetched = tripsService.get(db, created.trip.id);
    expect(fetched?.trip.id).toBe(created.trip.id);
    expect(fetched?.days).toHaveLength(2);
  });
});
