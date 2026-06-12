import ExcelJS from "exceljs";
import type {
  HomeofficeExport,
  ReisekostenExport,
  SteuerUebersichtExport,
} from "../services/export.ts";

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

export async function steuerUebersichtToXlsx(data: SteuerUebersichtExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Steuer ${data.year}`);

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 6;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 60;

  function setBorder(cell: ExcelJS.Cell): void {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
      bottom: { style: "thin" },
    };
  }

  const personalRows: Array<[string, string]> = [
    [data.personal.name, ""],
    [data.personal.strasse, ""],
    [`${data.personal.plz} ${data.personal.ort}`.trim(), ""],
    [`Arbeitgeber: ${data.personal.arbeitgeber}`, ""],
    [`Eintrittsdatum: ${data.personal.eintrittsdatum}`, ""],
  ];

  const kpiRows: Array<{ value: number | string; isEur: boolean; label: string }> = [
    {
      value: data.abwesenheit_8h_inland,
      isEur: false,
      label: "Abwesenheit von mehr als 8 Stunden im Inland",
    },
    {
      value: data.an_abreise_inland,
      isEur: false,
      label:
        "An- und Abreisetage bei einer mehrtägigen Auswärtstätigkeit mit Übernachtung im Inland",
    },
    {
      value: data.abwesenheit_24h_inland,
      isEur: false,
      label: "Abwesenheit von 24 Stunden im Inland",
    },
    {
      value: data.kuerzung_inland_cent / 100,
      isEur: true,
      label:
        "Kürzungsbeträge wegen Mahlzeitengestellung (eigene Zuzahlungen sind ggf. gegenzurechnen)",
    },
    {
      value: data.anrechenbar_inland_cent / 100,
      isEur: true,
      label: "Anrechenbare Mehraufwendungen",
    },
    {
      value: data.anrechenbar_ausland_cent === null ? "" : data.anrechenbar_ausland_cent / 100,
      isEur: true,
      label: "Summe aller Mehraufwendungen für Verpflegung bei einer Auswärtstätigkeit im Ausland",
    },
    { value: data.homeoffice_tage, isEur: false, label: "Homeoffice Tage" },
  ];

  const maxRows = Math.max(personalRows.length, kpiRows.length);
  for (let i = 0; i < maxRows; i++) {
    const row = ws.getRow(i + 1);
    row.height = 22;

    const p = personalRows[i];
    if (p) {
      row.getCell(1).value = p[0];
      setBorder(row.getCell(1));
    }

    const k = kpiRows[i];
    if (k) {
      const valueCell = row.getCell(3);
      valueCell.value = k.value;
      valueCell.alignment = { horizontal: "right" };
      if (k.isEur && typeof k.value === "number") {
        valueCell.numFmt = CURRENCY_FMT;
      } else if (k.isEur && k.value === "") {
        valueCell.value = "-";
      }
      setBorder(valueCell);
      const labelCell = row.getCell(4);
      labelCell.value = k.label;
      setBorder(labelCell);
    }
  }

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
