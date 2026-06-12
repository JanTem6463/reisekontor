import PDFDocument from "pdfkit";
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

function formatEur(cent: number): string {
  return `${(cent / 100).toFixed(2).replace(".", ",")} €`;
}

type PDFDoc = InstanceType<typeof PDFDocument>;

function bufferDoc(doc: PDFDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function reisekostenToPdf(data: ReisekostenExport): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 30 });

  doc.fontSize(16).text(`Reisekosten ${data.year}`, { align: "left" });
  doc.fontSize(9).text(`Erstellt am ${new Date().toISOString().slice(0, 10)}`, { align: "right" });
  doc.moveDown();

  const cols = [
    { label: "Datum", width: 60 },
    { label: "Tagestyp", width: 110 },
    { label: "F", width: 18 },
    { label: "M", width: 18 },
    { label: "A", width: 18 },
    { label: "Zuzahlung", width: 60 },
    { label: "Pauschale", width: 60 },
    { label: "Kürzung", width: 60 },
    { label: "Absetzbar", width: 60 },
  ];

  function drawHeader() {
    doc.font("Helvetica-Bold").fontSize(9);
    let x = doc.x;
    const y = doc.y;
    for (const c of cols) {
      doc.text(c.label, x, y, { width: c.width, align: "left" });
      x += c.width;
    }
    doc.moveDown(0.6);
    doc.font("Helvetica");
  }

  drawHeader();

  for (const r of data.rows) {
    if (doc.y > 750) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    let x = doc.x;
    const values = [
      r.date,
      DAY_TYPE_LABELS_DE[r.type] ?? r.type,
      r.fruehstueck ? "X" : "",
      r.mittag ? "X" : "",
      r.abend ? "X" : "",
      formatEur(r.zuzahlungCent),
      formatEur(r.pauschaleCent),
      formatEur(r.kuerzungCent),
      formatEur(r.absetzbarCent),
    ];
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const val = values[i];
      if (!col || val === undefined) continue;
      doc.text(val, x, y, { width: col.width, align: "left" });
      x += col.width;
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text(
    `Summe Pauschale: ${formatEur(data.summe_pauschale_cent)}   Kürzung: ${formatEur(
      data.summe_kuerzung_cent,
    )}   Absetzbar: ${formatEur(data.summe_absetzbar_cent)}`,
  );

  return bufferDoc(doc);
}

export async function steuerUebersichtToPdf(data: SteuerUebersichtExport): Promise<Buffer> {
  const MARGIN = 40;
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const PAGE_WIDTH = doc.page.width;
  const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
  const VALUE_COL_WIDTH = 80;
  const GAP = 12;
  const LABEL_X = MARGIN + VALUE_COL_WIDTH + GAP;
  const LABEL_COL_WIDTH = PAGE_WIDTH - LABEL_X - MARGIN;
  const ROW_GAP = 6;

  doc
    .fontSize(16)
    .text(`Steuer-Übersicht ${data.year}`, MARGIN, MARGIN, { width: CONTENT_WIDTH });
  doc
    .fontSize(9)
    .text(`Erstellt am ${new Date().toISOString().slice(0, 10)}`, MARGIN, MARGIN, {
      width: CONTENT_WIDTH,
      align: "right",
    });
  doc.moveDown(1.5);

  // Stammdaten — vertikale Liste, immer am linken Margin
  doc.font("Helvetica-Bold").fontSize(11).text("Stammdaten", MARGIN, doc.y);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10);
  const p = data.personal;
  const stammLines = [
    p.name,
    p.strasse,
    `${p.plz} ${p.ort}`.trim(),
    `Arbeitgeber: ${p.arbeitgeber}`,
    `Eintrittsdatum: ${p.eintrittsdatum}`,
  ];
  for (const line of stammLines) {
    doc.text(line, MARGIN, doc.y, { width: CONTENT_WIDTH });
  }
  doc.moveDown(1);

  // Kennzahlen — Tabelle: Value rechtsbündig, Label linksbündig
  doc.font("Helvetica-Bold").fontSize(11).text("Kennzahlen", MARGIN, doc.y);
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10);

  const rows: Array<{ value: string; label: string }> = [
    {
      value: String(data.abwesenheit_8h_inland),
      label: "Abwesenheit von mehr als 8 Stunden im Inland",
    },
    {
      value: String(data.an_abreise_inland),
      label:
        "An- und Abreisetage bei einer mehrtägigen Auswärtstätigkeit mit Übernachtung im Inland",
    },
    { value: String(data.abwesenheit_24h_inland), label: "Abwesenheit von 24 Stunden im Inland" },
    {
      value: formatEur(data.kuerzung_inland_cent),
      label:
        "Kürzungsbeträge wegen Mahlzeitengestellung (eigene Zuzahlungen sind ggf. gegenzurechnen)",
    },
    {
      value: formatEur(data.anrechenbar_inland_cent),
      label: "Anrechenbare Mehraufwendungen",
    },
    {
      value:
        data.anrechenbar_ausland_cent === null ? "-" : formatEur(data.anrechenbar_ausland_cent),
      label: "Summe aller Mehraufwendungen für Verpflegung bei einer Auswärtstätigkeit im Ausland",
    },
    { value: String(data.homeoffice_tage), label: "Homeoffice Tage" },
  ];

  for (const r of rows) {
    const y = doc.y;
    const labelHeight = doc.heightOfString(r.label, { width: LABEL_COL_WIDTH });
    const valueHeight = doc.heightOfString(r.value, { width: VALUE_COL_WIDTH });
    const rowHeight = Math.max(labelHeight, valueHeight);

    doc.text(r.value, MARGIN, y, { width: VALUE_COL_WIDTH, align: "right" });
    doc.text(r.label, LABEL_X, y, { width: LABEL_COL_WIDTH });

    doc.x = MARGIN;
    doc.y = y + rowHeight + ROW_GAP;
  }

  return bufferDoc(doc);
}

export async function homeofficeToPdf(data: HomeofficeExport): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 30 });

  doc.fontSize(16).text(`Homeoffice ${data.year}`, { align: "left" });
  doc.fontSize(9).text(`Erstellt am ${new Date().toISOString().slice(0, 10)}`, { align: "right" });
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("Datum");
  doc.font("Helvetica").fontSize(9);

  for (const r of data.rows) {
    if (doc.y > 750) {
      doc.addPage();
      doc.font("Helvetica-Bold").fontSize(11).text("Datum");
      doc.font("Helvetica").fontSize(9);
    }
    doc.text(r.date);
  }

  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text(`Anzahl Tage: ${data.anzahl_tage} (max. ${data.max_tage})`);
  doc.text(
    `Pauschale gesamt: ${formatEur(data.betrag_gesamt_cent)} (max. ${formatEur(
      data.max_betrag_cent,
    )})`,
  );

  return bufferDoc(doc);
}
