import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { type Db, createDb } from "../db/client.ts";
import * as daysService from "./days.ts";
import { buildHomeofficeRows, buildReisekostenRows } from "./export.ts";
import * as tripsService from "./trips.ts";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400,
        grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560,
        kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600,
        homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: (year) => {
    if (year !== 2026) throw new Error(`Keine Sätze für ${year}`);
    return {
      kleineCent: 1400,
      grosseCent: 2800,
      kuerzFruehstueckCent: 560,
      kuerzHauptCent: 1120,
      homeofficeProTagCent: 600,
      homeofficeMaxCent: 126000,
    };
  },
};

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("buildReisekostenRows", () => {
  it("leeres Jahr → 0 Rows, Summen 0", () => {
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    expect(r.rows).toEqual([]);
    expect(r.summe_absetzbar_cent).toBe(0);
    expect(r.summe_kuerzung_cent).toBe(0);
    expect(r.summe_pauschale_cent).toBe(0);
  });

  it("3-Tages-Reise ohne Mahlzeiten → 3 Rows, absetzbar = 1400+2800+1400 = 5600", () => {
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    expect(r.rows).toHaveLength(3);
    expect(r.summe_absetzbar_cent).toBe(1400 + 2800 + 1400);
    expect(r.summe_kuerzung_cent).toBe(0);
  });

  it("Voller Tag mit Frühstück+Abend → kuerzung=1680, absetzbar=1120", () => {
    const trip = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: trip.trip.id,
      fruehstueck: true,
      mittag: false,
      abend: true,
      zuzahlungCent: 0,
    });
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    const tag2 = r.rows.find((x) => x.date === "2026-04-02");
    expect(tag2?.kuerzungCent).toBe(1680);
    expect(tag2?.absetzbarCent).toBe(1120);
  });

  it("sortiert nach Datum", () => {
    tripsService.create(db, {
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      uebernachtung: true,
    });
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      uebernachtung: true,
    });
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    expect(r.rows[0]?.date).toBe("2026-04-01");
  });
});

describe("buildHomeofficeRows", () => {
  it("leeres Jahr → 0 Rows, Summen 0", () => {
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.rows).toEqual([]);
    expect(r.anzahl_tage).toBe(0);
    expect(r.betrag_gesamt_cent).toBe(0);
    expect(r.max_tage).toBe(210);
    expect(r.max_betrag_cent).toBe(126000);
  });

  it("5 HO + Urlaub + Krankheit → 5 Rows, Urlaub/Krankheit ausgeschlossen", () => {
    for (let i = 1; i <= 5; i++) {
      daysService.upsert(db, {
        date: `2026-01-0${i}`,
        year: 2026,
        type: "homeoffice",
        homeoffice: false,
        tripId: null,
        fruehstueck: false,
        mittag: false,
        abend: false,
        zuzahlungCent: 0,
      });
    }
    daysService.upsert(db, {
      date: "2026-07-01",
      year: 2026,
      type: "urlaub",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    daysService.upsert(db, {
      date: "2026-07-02",
      year: 2026,
      type: "krankheit",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.rows).toHaveLength(5);
    expect(r.anzahl_tage).toBe(5);
    expect(r.betrag_gesamt_cent).toBe(3000);
  });

  it("215 HO-Tage → 215 Rows aber betrag_gesamt = 126000 cent (Deckel)", () => {
    for (let i = 0; i < 215; i++) {
      const month = Math.floor(i / 28) + 1;
      const day = (i % 28) + 1;
      daysService.upsert(db, {
        date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        year: 2026,
        type: "homeoffice",
        homeoffice: false,
        tripId: null,
        fruehstueck: false,
        mittag: false,
        abend: false,
        zuzahlungCent: 0,
      });
    }
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.anzahl_tage).toBe(215);
    expect(r.betrag_gesamt_cent).toBe(126000);
  });

  it("Kombi-Tag (Anreise + homeoffice=true) zählt mit", () => {
    const trip = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    daysService.upsert(db, {
      date: "2026-04-01",
      year: 2026,
      type: "reise_anreise",
      homeoffice: true,
      tripId: trip.trip.id,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.anzahl_tage).toBe(1);
    expect(r.rows.some((x) => x.date === "2026-04-01")).toBe(true);
  });
});
