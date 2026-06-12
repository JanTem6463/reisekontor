import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { type Db, createDb } from "../db/client.ts";
import * as daysService from "./days.ts";
import { buildHomeofficeRows, buildReisekostenRows, buildSteuerUebersicht } from "./export.ts";
import * as tripsService from "./trips.ts";

function buildFixtureConfig(
  standardwoche: AppConfig["raw"]["standardwoche"],
  personal?: AppConfig["raw"]["personal"],
): AppConfig {
  return {
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
      standardwoche,
      feiertage: { bundesland: "NI" },
      ...(personal ? { personal } : {}),
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
}

const NO_AUTO_HO: AppConfig["raw"]["standardwoche"] = {
  mo: false,
  di: false,
  mi: false,
  do: false,
  fr: false,
  sa: false,
  so: false,
};
const MO_FR: AppConfig["raw"]["standardwoche"] = {
  mo: true,
  di: true,
  mi: true,
  do: true,
  fr: true,
  sa: false,
  so: false,
};

const fixtureConfig = buildFixtureConfig(NO_AUTO_HO);

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
  it("leeres Jahr + Auto aus → 0 Rows, Summen 0", () => {
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.rows).toEqual([]);
    expect(r.anzahl_tage).toBe(0);
    expect(r.betrag_gesamt_cent).toBe(0);
    expect(r.max_tage).toBe(210);
    expect(r.max_betrag_cent).toBe(126000);
  });

  it("5 explizite HO + Urlaub + Krankheit → 5 Rows, Urlaub/Krankheit ausgeschlossen", () => {
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

  it("215 explizite HO-Tage → 215 Rows aber betrag_gesamt = 126000 cent (Deckel)", () => {
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

  it("Mo-Fr-Standardwoche + leeres Jahr 2026 → 261 Werktage, Betrag gedeckelt", () => {
    const cfg = buildFixtureConfig(MO_FR);
    const r = buildHomeofficeRows(db, 2026, cfg);
    expect(r.anzahl_tage).toBe(261);
    expect(r.rows).toHaveLength(261);
    expect(r.betrag_gesamt_cent).toBe(126000);
    expect(r.rows[0]?.date).toBe("2026-01-01");
  });

  it("Mo-Fr + reise_voll am Werktag → sperrt diesen Tag im HO-Export", () => {
    const cfg = buildFixtureConfig(MO_FR);
    // 2026-04-02 ist Donnerstag → ohne Eintrag wäre HO
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const r = buildHomeofficeRows(db, 2026, cfg);
    expect(r.rows.some((x) => x.date === "2026-04-02")).toBe(false);
    expect(r.anzahl_tage).toBe(260);
  });
});

describe("buildSteuerUebersicht", () => {
  it("leeres Jahr → alle KPIs 0, Personal aus Config", () => {
    const cfg = buildFixtureConfig(NO_AUTO_HO, {
      name: "Jan Test",
      strasse: "Teststr. 1",
      plz: "12345",
      ort: "Teststadt",
      arbeitgeber: "TestAG",
      eintrittsdatum: "01.01.2020",
    });
    const r = buildSteuerUebersicht(db, 2026, cfg);
    expect(r.year).toBe(2026);
    expect(r.personal.name).toBe("Jan Test");
    expect(r.personal.strasse).toBe("Teststr. 1");
    expect(r.personal.eintrittsdatum).toBe("01.01.2020");
    expect(r.abwesenheit_8h_inland).toBe(0);
    expect(r.an_abreise_inland).toBe(0);
    expect(r.abwesenheit_24h_inland).toBe(0);
    expect(r.kuerzung_inland_cent).toBe(0);
    expect(r.anrechenbar_inland_cent).toBe(0);
    expect(r.anrechenbar_ausland_cent).toBeNull();
    expect(r.homeoffice_tage).toBe(0);
  });

  it("3-Tages-Reise mit Übernachtung + 1 eintägige + Frühstück-Kürzung", () => {
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    // Eintägige Reise
    tripsService.create(db, {
      startDate: "2026-05-01",
      endDate: "2026-05-01",
      uebernachtung: false,
    });
    // Frühstück am vollen Tag → 560 Cent Kürzung
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: null,
      fruehstueck: true,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });

    const r = buildSteuerUebersicht(db, 2026, fixtureConfig);
    expect(r.abwesenheit_8h_inland).toBe(1); // eintägig
    expect(r.an_abreise_inland).toBe(2); // Anreise + Abreise
    expect(r.abwesenheit_24h_inland).toBe(1); // voller Tag
    expect(r.kuerzung_inland_cent).toBe(560);
    // Pauschalen: 14 + 28 + 14 + 14 = 70 €; Kürzung 5,60 → 64,40
    expect(r.anrechenbar_inland_cent).toBe(7000 - 560);
  });

  it("Personal-Felder fehlen → leere Strings", () => {
    const r = buildSteuerUebersicht(db, 2026, fixtureConfig); // ohne personal
    expect(r.personal.name).toBe("");
    expect(r.personal.eintrittsdatum).toBe("");
  });

  it("HO-Tage kommen aus standardwoche-Auto", () => {
    const cfg = buildFixtureConfig(MO_FR);
    const r = buildSteuerUebersicht(db, 2026, cfg);
    expect(r.homeoffice_tage).toBe(261); // alle Mo-Fr 2026
  });
});
