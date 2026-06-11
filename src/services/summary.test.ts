import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { type Db, createDb } from "../db/client.ts";
import * as daysService from "./days.ts";
import { computeSummary } from "./summary.ts";
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

describe("computeSummary", () => {
  it("leeres Jahr → alle Werte 0, max-Werte aus config", () => {
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.verpflegungSummeCent).toBe(0);
    expect(result.kuerzungSummeCent).toBe(0);
    expect(result.homeofficeTage).toBe(0);
    expect(result.homeofficeBetragCent).toBe(0);
    expect(result.homeofficeMaxTage).toBe(210);
    expect(result.homeofficeMaxBetragCent).toBe(126000);
    expect(result.reisenAnzahl).toBe(0);
    expect(result.reisetageNachTyp).toEqual({
      reise_anreise: 0,
      reise_voll: 0,
      reise_abreise: 0,
      reise_eintaegig: 0,
    });
  });

  it("3-Tages-Reise ohne Mahlzeiten → 14 + 28 + 14 = 56 €", () => {
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.verpflegungSummeCent).toBe(1400 + 2800 + 1400);
    expect(result.reisenAnzahl).toBe(1);
    expect(result.reisetageNachTyp.reise_anreise).toBe(1);
    expect(result.reisetageNachTyp.reise_voll).toBe(1);
    expect(result.reisetageNachTyp.reise_abreise).toBe(1);
  });

  it("5 HO-Tage → 30 €", () => {
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
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.homeofficeTage).toBe(5);
    expect(result.homeofficeBetragCent).toBe(3000);
  });

  it("215 HO-Tage → Deckel 1.260 €", () => {
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
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.homeofficeTage).toBe(215);
    expect(result.homeofficeBetragCent).toBe(126000);
  });

  it("Urlaub/Krankheit/Feiertag NICHT im HO-Zähler", () => {
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
    daysService.upsert(db, {
      date: "2026-12-25",
      year: 2026,
      type: "feiertag",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.homeofficeTage).toBe(0);
  });
});
