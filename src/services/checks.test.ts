import { beforeEach, describe, expect, it } from "vitest";
import { type Db, createDb } from "../db/client.ts";
import { checkYear } from "./checks.ts";
import * as daysService from "./days.ts";

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("checkYear", () => {
  it("leeres Jahr → []", () => {
    expect(checkYear(db, 2026)).toEqual([]);
  });

  it("homeoffice-Tag → HO_KONFLIKT_ENTFERNUNG", () => {
    daysService.upsert(db, {
      date: "2026-03-15",
      year: 2026,
      type: "homeoffice",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const hinweise = checkYear(db, 2026);
    expect(hinweise).toHaveLength(1);
    expect(hinweise[0]?.code).toBe("HO_KONFLIKT_ENTFERNUNG");
    expect(hinweise[0]?.date).toBe("2026-03-15");
  });

  it("reise_voll + homeoffice=true → DOPPEL_HO_REISE_VOLL", () => {
    daysService.upsert(db, {
      date: "2026-03-15",
      year: 2026,
      type: "reise_voll",
      homeoffice: true,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const hinweise = checkYear(db, 2026);
    expect(hinweise.some((h) => h.code === "DOPPEL_HO_REISE_VOLL")).toBe(true);
  });

  it("filtert nach Jahr — andere Jahre nicht mit drin", () => {
    daysService.upsert(db, {
      date: "2025-12-31",
      year: 2025,
      type: "homeoffice",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    expect(checkYear(db, 2026)).toEqual([]);
  });
});
