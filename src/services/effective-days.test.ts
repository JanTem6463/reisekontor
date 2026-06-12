import { describe, expect, it } from "vitest";
import type { dayEntries } from "../db/schema.ts";
import { computeEffectiveHomeofficeDates, homeofficeBetragCent } from "./effective-days.ts";
import type { Standardwoche } from "./settings.ts";

type DbDayRow = typeof dayEntries.$inferSelect;

const MO_FR: Standardwoche = {
  mo: true,
  di: true,
  mi: true,
  do: true,
  fr: true,
  sa: false,
  so: false,
};
const NONE: Standardwoche = {
  mo: false,
  di: false,
  mi: false,
  do: false,
  fr: false,
  sa: false,
  so: false,
};

function row(date: string, overrides: Partial<DbDayRow>): DbDayRow {
  return {
    date,
    year: Number.parseInt(date.slice(0, 4), 10),
    type: "homeoffice",
    homeoffice: false,
    tripId: null,
    fruehstueck: false,
    mittag: false,
    abend: false,
    zuzahlungCent: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as DbDayRow;
}

describe("computeEffectiveHomeofficeDates", () => {
  it("leeres Jahr + leere Standardwoche → 0 Tage", () => {
    const r = computeEffectiveHomeofficeDates(2026, [], NONE);
    expect(r).toEqual([]);
  });

  it("leeres Jahr 2026 + Mo-Fr → genau die Werktage", () => {
    const r = computeEffectiveHomeofficeDates(2026, [], MO_FR);
    // 2026 ist kein Schaltjahr; 365 Tage, ~261 Werktage Mo-Fr
    expect(r.length).toBeGreaterThanOrEqual(260);
    expect(r.length).toBeLessThanOrEqual(262);
    // Erster Werktag 2026 ist Donnerstag 01.01.
    expect(r[0]).toBe("2026-01-01");
    // Sa/So darf nicht drin sein
    const so = new Date("2026-01-04T00:00:00Z").getUTCDay();
    expect(so).toBe(0);
    expect(r).not.toContain("2026-01-03"); // Sa
    expect(r).not.toContain("2026-01-04"); // So
  });

  it("expliziter homeoffice-Eintrag zählt auch an Wochenenden", () => {
    const r = computeEffectiveHomeofficeDates(
      2026,
      [row("2026-01-03", { type: "homeoffice" })],
      NONE,
    );
    expect(r).toEqual(["2026-01-03"]);
  });

  it("DB-Eintrag büro sperrt einen Mo-Fr-Werktag", () => {
    // 2026-01-02 ist Freitag
    const r = computeEffectiveHomeofficeDates(2026, [row("2026-01-02", { type: "buero" })], MO_FR);
    expect(r).not.toContain("2026-01-02");
    // 01.01. (Do) bleibt drin
    expect(r).toContain("2026-01-01");
  });

  it("urlaub/krankheit/feiertag sperren den Werktag", () => {
    const r = computeEffectiveHomeofficeDates(
      2026,
      [
        row("2026-01-01", { type: "feiertag" }),
        row("2026-01-02", { type: "urlaub" }),
        row("2026-01-05", { type: "krankheit" }),
      ],
      MO_FR,
    );
    expect(r).not.toContain("2026-01-01");
    expect(r).not.toContain("2026-01-02");
    expect(r).not.toContain("2026-01-05");
  });

  it("reise_voll/reise_eintaegig sperren den Werktag", () => {
    const r = computeEffectiveHomeofficeDates(
      2026,
      [row("2026-01-01", { type: "reise_voll" }), row("2026-01-02", { type: "reise_eintaegig" })],
      MO_FR,
    );
    expect(r).not.toContain("2026-01-01");
    expect(r).not.toContain("2026-01-02");
  });

  it("reise_anreise ohne HO-Combo sperrt; mit HO-Combo zählt", () => {
    const r = computeEffectiveHomeofficeDates(
      2026,
      [
        row("2026-04-01", { type: "reise_anreise", homeoffice: false }),
        row("2026-04-03", { type: "reise_abreise", homeoffice: true }),
      ],
      NONE,
    );
    expect(r).not.toContain("2026-04-01");
    expect(r).toContain("2026-04-03");
  });

  it("Ergebnis ist chronologisch sortiert", () => {
    const r = computeEffectiveHomeofficeDates(2026, [], MO_FR);
    const sorted = [...r].sort();
    expect(r).toEqual(sorted);
  });
});

describe("homeofficeBetragCent", () => {
  it("unter dem Deckel: count * pro_tag", () => {
    expect(homeofficeBetragCent(10, 600, 126000)).toBe(6000);
  });
  it("am Deckel: gedeckelt", () => {
    expect(homeofficeBetragCent(300, 600, 126000)).toBe(126000);
  });
  it("0 Tage → 0", () => {
    expect(homeofficeBetragCent(0, 600, 126000)).toBe(0);
  });
});
