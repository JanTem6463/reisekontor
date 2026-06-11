import { describe, expect, it } from "vitest";
import { homeofficeToPdf, reisekostenToPdf } from "./pdf.ts";

describe("reisekostenToPdf", () => {
  it("erzeugt einen non-empty PDF-Buffer mit %PDF-Header", async () => {
    const buf = await reisekostenToPdf({
      year: 2026,
      rows: [],
      summe_pauschale_cent: 0,
      summe_kuerzung_cent: 0,
      summe_absetzbar_cent: 0,
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("erzeugt PDF mit Daten", async () => {
    const buf = await reisekostenToPdf({
      year: 2026,
      rows: [
        {
          date: "2026-04-02",
          type: "reise_voll",
          fruehstueck: false,
          mittag: false,
          abend: true,
          zuzahlungCent: 0,
          pauschaleCent: 2800,
          kuerzungCent: 1120,
          absetzbarCent: 1680,
        },
      ],
      summe_pauschale_cent: 2800,
      summe_kuerzung_cent: 1120,
      summe_absetzbar_cent: 1680,
    });
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe("homeofficeToPdf", () => {
  it("erzeugt einen non-empty PDF-Buffer", async () => {
    const buf = await homeofficeToPdf({
      year: 2026,
      rows: [{ date: "2026-03-15" }],
      anzahl_tage: 1,
      betrag_pro_tag_cent: 600,
      betrag_gesamt_cent: 600,
      max_tage: 210,
      max_betrag_cent: 126000,
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
