import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { type Db, createDb } from "../db/client.ts";
import { getEffectiveSettings, updateSettings } from "./settings.ts";

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
  ratesForYear: () => ({
    kleineCent: 1400,
    grosseCent: 2800,
    kuerzFruehstueckCent: 560,
    kuerzHauptCent: 1120,
    homeofficeProTagCent: 600,
    homeofficeMaxCent: 126000,
  }),
};

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("getEffectiveSettings", () => {
  it("ohne DB-Override → Config-Werte", () => {
    const s = getEffectiveSettings(db, fixtureConfig);
    expect(s.bundesland).toBe("NI");
    expect(s.standardwoche.mo).toBe(true);
    expect(s.standardwoche.sa).toBe(false);
  });

  it("mit DB-Override → DB-Werte gewinnen", () => {
    updateSettings(db, { bundesland: "BY" }, fixtureConfig);
    const s = getEffectiveSettings(db, fixtureConfig);
    expect(s.bundesland).toBe("BY");
  });
});

describe("updateSettings", () => {
  it("speichert bundesland", () => {
    const s = updateSettings(db, { bundesland: "BY" }, fixtureConfig);
    expect(s.bundesland).toBe("BY");
    expect(getEffectiveSettings(db, fixtureConfig).bundesland).toBe("BY");
  });

  it("speichert standardwoche", () => {
    const sw = { mo: false, di: false, mi: false, do: false, fr: false, sa: true, so: true };
    const s = updateSettings(db, { standardwoche: sw }, fixtureConfig);
    expect(s.standardwoche).toEqual(sw);
  });

  it("partial update — bundesland bleibt erhalten", () => {
    updateSettings(db, { bundesland: "BY" }, fixtureConfig);
    updateSettings(
      db,
      {
        standardwoche: {
          mo: true,
          di: true,
          mi: true,
          do: true,
          fr: true,
          sa: false,
          so: false,
        },
      },
      fixtureConfig,
    );
    const s = getEffectiveSettings(db, fixtureConfig);
    expect(s.bundesland).toBe("BY");
  });

  it("ungültiges Bundesland → wirft", () => {
    expect(() => updateSettings(db, { bundesland: "XX" }, fixtureConfig)).toThrow();
  });

  it("Bundesland anderer Länge → wirft", () => {
    expect(() => updateSettings(db, { bundesland: "NIEDERSACHSEN" }, fixtureConfig)).toThrow();
  });
});
