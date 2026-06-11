import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { homeofficeToXlsx, reisekostenToXlsx } from "./xlsx.ts";

describe("reisekostenToXlsx", () => {
  it("erzeugt einen gültigen Workbook", async () => {
    const buf = await reisekostenToXlsx({
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

    const wb = new ExcelJS.Workbook();
    // exceljs declares a global `Buffer extends ArrayBuffer` that conflicts with @types/node Buffer
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet(1);
    expect(ws?.name).toBe("Reisekosten 2026");
    expect(ws?.getRow(1).getCell(1).value).toBe("Datum");
    expect(ws?.getRow(1).font?.bold).toBe(true);
    expect(ws?.getRow(2).getCell(1).value).toBe("2026-04-02");
  });
});

describe("homeofficeToXlsx", () => {
  it("erzeugt einen gültigen Workbook", async () => {
    const buf = await homeofficeToXlsx({
      year: 2026,
      rows: [{ date: "2026-03-15" }],
      anzahl_tage: 1,
      betrag_pro_tag_cent: 600,
      betrag_gesamt_cent: 600,
      max_tage: 210,
      max_betrag_cent: 126000,
    });
    expect(buf.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    // exceljs declares a global `Buffer extends ArrayBuffer` that conflicts with @types/node Buffer
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.getWorksheet(1)?.name).toBe("Homeoffice 2026");
  });
});
