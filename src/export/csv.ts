import type {
  HomeofficeExport,
  ReisekostenExport,
  SteuerUebersichtExport,
} from "../services/export.ts";

const BOM = "﻿";
const SEP = ";";
const NL = "\r\n";

function formatEur(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",");
}

function yesNo(b: boolean): string {
  return b ? "Ja" : "Nein";
}

const DAY_TYPE_LABELS_DE: Record<string, string> = {
  reise_anreise: "Reise – Anreise",
  reise_voll: "Reise – voller Tag",
  reise_abreise: "Reise – Abreise",
  reise_eintaegig: "Reise – eintägig",
};

export function reisekostenToCsv(data: ReisekostenExport): Buffer {
  const header = [
    "Datum",
    "Tagestyp",
    "Frühstück",
    "Mittag",
    "Abend",
    "Zuzahlung",
    "Pauschale",
    "Kürzung",
    "Absetzbar",
  ].join(SEP);

  const body = data.rows.map((r) =>
    [
      r.date,
      DAY_TYPE_LABELS_DE[r.type] ?? r.type,
      yesNo(r.fruehstueck),
      yesNo(r.mittag),
      yesNo(r.abend),
      formatEur(r.zuzahlungCent),
      formatEur(r.pauschaleCent),
      formatEur(r.kuerzungCent),
      formatEur(r.absetzbarCent),
    ].join(SEP),
  );

  const footer = [
    "SUMME",
    "",
    "",
    "",
    "",
    "",
    formatEur(data.summe_pauschale_cent),
    formatEur(data.summe_kuerzung_cent),
    formatEur(data.summe_absetzbar_cent),
  ].join(SEP);

  const lines = [header, ...body, footer].join(NL);
  return Buffer.from(BOM + lines, "utf8");
}

export function steuerUebersichtToCsv(data: SteuerUebersichtExport): Buffer {
  const p = data.personal;
  const stamm = [
    `Name${SEP}${p.name}`,
    `Strasse${SEP}${p.strasse}`,
    `PLZ Ort${SEP}${p.plz} ${p.ort}`,
    `Arbeitgeber${SEP}${p.arbeitgeber}`,
    `Eintrittsdatum${SEP}${p.eintrittsdatum}`,
  ];
  const kennzahlen = [
    `Abwesenheit von mehr als 8 Stunden im Inland${SEP}${data.abwesenheit_8h_inland}`,
    `An- und Abreisetage bei einer mehrtägigen Auswärtstätigkeit mit Übernachtung im Inland${SEP}${data.an_abreise_inland}`,
    `Abwesenheit von 24 Stunden im Inland${SEP}${data.abwesenheit_24h_inland}`,
    `Kürzungsbeträge wegen Mahlzeitengestellung${SEP}${formatEur(data.kuerzung_inland_cent)}`,
    `Anrechenbare Mehraufwendungen${SEP}${formatEur(data.anrechenbar_inland_cent)}`,
    `Summe aller Mehraufwendungen für Verpflegung bei einer Auswärtstätigkeit im Ausland${SEP}${
      data.anrechenbar_ausland_cent === null ? "-" : formatEur(data.anrechenbar_ausland_cent)
    }`,
    `Homeoffice Tage${SEP}${data.homeoffice_tage}`,
  ];
  const lines = [`Steuer-Übersicht ${data.year}`, "", ...stamm, "", ...kennzahlen].join(NL);
  return Buffer.from(BOM + lines, "utf8");
}

export function homeofficeToCsv(data: HomeofficeExport): Buffer {
  const header = "Datum";
  const body = data.rows.map((r) => r.date);
  const footer = [
    `Anzahl Tage${SEP}${data.anzahl_tage}`,
    `Pauschale gesamt${SEP}${formatEur(data.betrag_gesamt_cent)}`,
    `Max Tage${SEP}${data.max_tage}`,
    `Max Betrag${SEP}${formatEur(data.max_betrag_cent)}`,
  ].join(NL);

  const lines = [header, ...body, "", footer].join(NL);
  return Buffer.from(BOM + lines, "utf8");
}
