import { describe, expect, it } from "vitest";
import { homeofficeToCsv, reisekostenToCsv } from "./csv.ts";

describe("reisekostenToCsv", () => {
  it("leerer Export → BOM + Header + Footer", () => {
    const out = reisekostenToCsv({
      year: 2026,
      rows: [],
      summe_pauschale_cent: 0,
      summe_kuerzung_cent: 0,
      summe_absetzbar_cent: 0,
    }).toString("utf8");
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("Datum;Tagestyp");
    expect(out).toContain("SUMME");
  });

  it("eine Reisezeile + Summe", () => {
    const out = reisekostenToCsv({
      year: 2026,
      rows: [
        {
          date: "2026-04-02",
          type: "reise_voll",
          fruehstueck: true,
          mittag: false,
          abend: true,
          zuzahlungCent: 0,
          pauschaleCent: 2800,
          kuerzungCent: 1680,
          absetzbarCent: 1120,
        },
      ],
      summe_pauschale_cent: 2800,
      summe_kuerzung_cent: 1680,
      summe_absetzbar_cent: 1120,
    }).toString("utf8");
    expect(out).toContain("2026-04-02");
    expect(out).toContain("Reise – voller Tag");
    expect(out).toContain("28,00");
    expect(out).toContain("16,80");
    expect(out).toContain("11,20");
  });
});

describe("homeofficeToCsv", () => {
  it("leerer Export → BOM + Header + Footer", () => {
    const out = homeofficeToCsv({
      year: 2026,
      rows: [],
      anzahl_tage: 0,
      betrag_pro_tag_cent: 600,
      betrag_gesamt_cent: 0,
      max_tage: 210,
      max_betrag_cent: 126000,
    }).toString("utf8");
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("Datum");
    expect(out).toContain("Anzahl Tage");
    expect(out).toContain("Max Betrag");
  });
});
