import PDFDocument from "pdfkit";
import type { HomeofficeExport, ReisekostenExport } from "../services/export.ts";

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
