import ExcelJS from "exceljs";
import type { HomeofficeExport, ReisekostenExport } from "../services/export.ts";

const DAY_TYPE_LABELS_DE: Record<string, string> = {
  reise_anreise: "Reise – Anreise",
  reise_voll: "Reise – voller Tag",
  reise_abreise: "Reise – Abreise",
  reise_eintaegig: "Reise – eintägig",
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E5E5" },
};

const CURRENCY_FMT = "#,##0.00 €";

export async function reisekostenToXlsx(data: ReisekostenExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Reisekosten ${data.year}`);

  ws.columns = [
    { header: "Datum", key: "date", width: 12 },
    { header: "Tagestyp", key: "type", width: 22 },
    { header: "Frühstück", key: "fruehstueck", width: 10 },
    { header: "Mittag", key: "mittag", width: 10 },
    { header: "Abend", key: "abend", width: 10 },
    { header: "Zuzahlung", key: "zuzahlung", width: 12, style: { numFmt: CURRENCY_FMT } },
    { header: "Pauschale", key: "pauschale", width: 12, style: { numFmt: CURRENCY_FMT } },
    { header: "Kürzung", key: "kuerzung", width: 12, style: { numFmt: CURRENCY_FMT } },
    { header: "Absetzbar", key: "absetzbar", width: 12, style: { numFmt: CURRENCY_FMT } },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;

  for (const r of data.rows) {
    ws.addRow({
      date: r.date,
      type: DAY_TYPE_LABELS_DE[r.type] ?? r.type,
      fruehstueck: r.fruehstueck ? "Ja" : "Nein",
      mittag: r.mittag ? "Ja" : "Nein",
      abend: r.abend ? "Ja" : "Nein",
      zuzahlung: r.zuzahlungCent / 100,
      pauschale: r.pauschaleCent / 100,
      kuerzung: r.kuerzungCent / 100,
      absetzbar: r.absetzbarCent / 100,
    });
  }

  const sumRow = ws.addRow({
    date: "SUMME",
    pauschale: data.summe_pauschale_cent / 100,
    kuerzung: data.summe_kuerzung_cent / 100,
    absetzbar: data.summe_absetzbar_cent / 100,
  });
  sumRow.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function homeofficeToXlsx(data: HomeofficeExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Homeoffice ${data.year}`);
  ws.columns = [{ header: "Datum", key: "date", width: 12 }];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = HEADER_FILL;
  for (const r of data.rows) ws.addRow({ date: r.date });

  ws.addRow({});
  const a = ws.addRow({ date: `Anzahl Tage: ${data.anzahl_tage}` });
  a.font = { bold: true };
  ws.addRow({
    date: `Pauschale gesamt: ${(data.betrag_gesamt_cent / 100).toFixed(2).replace(".", ",")} €`,
  });
  ws.addRow({ date: `Max Tage: ${data.max_tage}` });
  ws.addRow({
    date: `Max Betrag: ${(data.max_betrag_cent / 100).toFixed(2).replace(".", ",")} €`,
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
