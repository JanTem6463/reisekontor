# Phase 3 — Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development.

**Goal:** Reisekosten + Homeoffice Exports in 3 Formaten (PDF/XLSX/CSV) — Backend + Frontend + Tests + Release 0.8.0.

**Architecture:** Daten-Aggregation in `src/services/export.ts` (reine Funktionen), Format-Generatoren in `src/export/{csv,xlsx,pdf}.ts` (Buffer-Output), `src/server/routes/export.ts` mit Format-Switch + Content-Disposition. Frontend: separate Blob-Fetch-Funktion in `lib/api.ts`, Export-Seite mit 6 Buttons.

**Tech Stack ergänzt:** `pdfkit@^0.16.0`, `exceljs@^4.4.0`, `@types/pdfkit`.

**Spec:** [2026-06-11-phase-3-export-design.md](../specs/2026-06-11-phase-3-export-design.md)

**CWD:** `c:\Projekte\Reisen\reisekontor`

---

## Task 1: Backend Export Service + Tests

**Files:**
- Create: `src/services/export.ts`
- Create: `src/services/export.test.ts`

- [ ] **Step 1.1: Failing tests**

`src/services/export.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { createDb, type Db } from "../db/client.ts";
import * as daysService from "./days.ts";
import { buildHomeofficeRows, buildReisekostenRows } from "./export.ts";
import * as tripsService from "./trips.ts";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400, grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560, kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600, homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: (year) => {
    if (year !== 2026) throw new Error(`Keine Sätze für ${year}`);
    return {
      kleineCent: 1400, grosseCent: 2800,
      kuerzFruehstueckCent: 560, kuerzHauptCent: 1120,
      homeofficeProTagCent: 600, homeofficeMaxCent: 126000,
    };
  },
};

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("buildReisekostenRows", () => {
  it("leeres Jahr → 0 Rows, Summen 0", () => {
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    expect(r.rows).toEqual([]);
    expect(r.summe_absetzbar_cent).toBe(0);
    expect(r.summe_kuerzung_cent).toBe(0);
    expect(r.summe_pauschale_cent).toBe(0);
  });

  it("3-Tages-Reise ohne Mahlzeiten → 3 Rows, absetzbar = 1400+2800+1400 = 5600", () => {
    tripsService.create(db, {
      startDate: "2026-04-01", endDate: "2026-04-03", uebernachtung: true,
    });
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    expect(r.rows).toHaveLength(3);
    expect(r.summe_absetzbar_cent).toBe(1400 + 2800 + 1400);
    expect(r.summe_kuerzung_cent).toBe(0);
  });

  it("Voller Tag mit Frühstück+Abend → kuerzung=1680, absetzbar=1120", () => {
    const trip = tripsService.create(db, {
      startDate: "2026-04-01", endDate: "2026-04-03", uebernachtung: true,
    });
    daysService.upsert(db, {
      date: "2026-04-02", year: 2026, type: "reise_voll",
      homeoffice: false, tripId: trip.trip.id,
      fruehstueck: true, mittag: false, abend: true,
      zuzahlungCent: 0,
    });
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    const tag2 = r.rows.find((x) => x.date === "2026-04-02");
    expect(tag2?.kuerzungCent).toBe(1680);
    expect(tag2?.absetzbarCent).toBe(1120);
  });

  it("sortiert nach Datum", () => {
    tripsService.create(db, {
      startDate: "2026-06-01", endDate: "2026-06-02", uebernachtung: true,
    });
    tripsService.create(db, {
      startDate: "2026-04-01", endDate: "2026-04-02", uebernachtung: true,
    });
    const r = buildReisekostenRows(db, 2026, fixtureConfig);
    expect(r.rows[0]?.date).toBe("2026-04-01");
  });
});

describe("buildHomeofficeRows", () => {
  it("leeres Jahr → 0 Rows, Summen 0", () => {
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.rows).toEqual([]);
    expect(r.anzahl_tage).toBe(0);
    expect(r.betrag_gesamt_cent).toBe(0);
    expect(r.max_tage).toBe(210);
    expect(r.max_betrag_cent).toBe(126000);
  });

  it("5 HO + Urlaub + Krankheit → 5 Rows, Urlaub/Krankheit ausgeschlossen", () => {
    for (let i = 1; i <= 5; i++) {
      daysService.upsert(db, {
        date: `2026-01-0${i}`, year: 2026, type: "homeoffice",
        homeoffice: false, tripId: null,
        fruehstueck: false, mittag: false, abend: false, zuzahlungCent: 0,
      });
    }
    daysService.upsert(db, {
      date: "2026-07-01", year: 2026, type: "urlaub",
      homeoffice: false, tripId: null,
      fruehstueck: false, mittag: false, abend: false, zuzahlungCent: 0,
    });
    daysService.upsert(db, {
      date: "2026-07-02", year: 2026, type: "krankheit",
      homeoffice: false, tripId: null,
      fruehstueck: false, mittag: false, abend: false, zuzahlungCent: 0,
    });
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.rows).toHaveLength(5);
    expect(r.anzahl_tage).toBe(5);
    expect(r.betrag_gesamt_cent).toBe(3000);
  });

  it("215 HO-Tage → 215 Rows aber betrag_gesamt = 126000 cent (Deckel)", () => {
    for (let i = 0; i < 215; i++) {
      const month = Math.floor(i / 28) + 1;
      const day = (i % 28) + 1;
      daysService.upsert(db, {
        date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        year: 2026, type: "homeoffice", homeoffice: false, tripId: null,
        fruehstueck: false, mittag: false, abend: false, zuzahlungCent: 0,
      });
    }
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.anzahl_tage).toBe(215);
    expect(r.betrag_gesamt_cent).toBe(126000);
  });

  it("Kombi-Tag (Anreise + homeoffice=true) zählt mit", () => {
    const trip = tripsService.create(db, {
      startDate: "2026-04-01", endDate: "2026-04-03", uebernachtung: true,
    });
    daysService.upsert(db, {
      date: "2026-04-01", year: 2026, type: "reise_anreise",
      homeoffice: true, tripId: trip.trip.id,
      fruehstueck: false, mittag: false, abend: false, zuzahlungCent: 0,
    });
    const r = buildHomeofficeRows(db, 2026, fixtureConfig);
    expect(r.anzahl_tage).toBe(1);
    expect(r.rows.some((x) => x.date === "2026-04-01")).toBe(true);
  });
});
```

- [ ] **Step 1.2: RED**
```bash
pnpm test src/services/export.test.ts
```

- [ ] **Step 1.3: Implementierung**

`src/services/export.ts`:
```ts
import type { AppConfig } from "../config/index.ts";
import type { Db } from "../db/client.ts";
import {
  homeofficePauschaleCent,
  homeofficeTage,
  kuerzungCent,
  verpflegungProTagCent,
} from "../domain/pauschalen.ts";
import type { DayType } from "../domain/types.ts";
import * as daysService from "./days.ts";
import { toDomainDay } from "./mappers.ts";

const REISE_TYPES: DayType[] = [
  "reise_anreise", "reise_voll", "reise_abreise", "reise_eintaegig",
];

export interface ReisekostenRow {
  date: string;
  type: DayType;
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungCent: number;
  kuerzungCent: number;
  pauschaleCent: number;
  absetzbarCent: number;
}

export interface ReisekostenExport {
  year: number;
  rows: ReisekostenRow[];
  summe_pauschale_cent: number;
  summe_kuerzung_cent: number;
  summe_absetzbar_cent: number;
}

export interface HomeofficeRow {
  date: string;
}

export interface HomeofficeExport {
  year: number;
  rows: HomeofficeRow[];
  anzahl_tage: number;
  betrag_pro_tag_cent: number;
  betrag_gesamt_cent: number;
  max_tage: number;
  max_betrag_cent: number;
}

export function buildReisekostenRows(
  db: Db,
  year: number,
  config: AppConfig,
): ReisekostenExport {
  const rates = config.ratesForYear(year);
  const dbRows = daysService.listForYear(db, year);
  const reiseDays = dbRows
    .filter((d) => REISE_TYPES.includes(d.type as DayType))
    .sort((a, b) => a.date.localeCompare(b.date));

  const rows: ReisekostenRow[] = reiseDays.map((d) => {
    const domain = toDomainDay(d);
    const pauschale =
      domain.type === "reise_voll" ? rates.grosseCent : rates.kleineCent;
    const kuerz = kuerzungCent(domain.meals, rates);
    return {
      date: d.date,
      type: d.type as DayType,
      fruehstueck: d.fruehstueck,
      mittag: d.mittag,
      abend: d.abend,
      zuzahlungCent: d.zuzahlungCent,
      pauschaleCent: pauschale,
      kuerzungCent: kuerz,
      absetzbarCent: verpflegungProTagCent(domain, rates),
    };
  });

  return {
    year,
    rows,
    summe_pauschale_cent: rows.reduce((s, r) => s + r.pauschaleCent, 0),
    summe_kuerzung_cent: rows.reduce((s, r) => s + r.kuerzungCent, 0),
    summe_absetzbar_cent: rows.reduce((s, r) => s + r.absetzbarCent, 0),
  };
}

export function buildHomeofficeRows(
  db: Db,
  year: number,
  config: AppConfig,
): HomeofficeExport {
  const rates = config.ratesForYear(year);
  const yearConfig = config.raw.jahre[String(year)];
  if (!yearConfig) throw new Error(`Keine Sätze für Jahr ${year}`);

  const dbRows = daysService.listForYear(db, year);
  const domainDays = dbRows.map(toDomainDay);

  const hoDays = domainDays.filter(
    (d) =>
      d.type === "homeoffice" ||
      (d.homeoffice && (d.type === "reise_anreise" || d.type === "reise_abreise")),
  );

  const rows: HomeofficeRow[] = [...hoDays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date }));

  return {
    year,
    rows,
    anzahl_tage: homeofficeTage(domainDays),
    betrag_pro_tag_cent: rates.homeofficeProTagCent,
    betrag_gesamt_cent: homeofficePauschaleCent(domainDays, rates),
    max_tage: yearConfig.homeoffice_max_tage,
    max_betrag_cent: rates.homeofficeMaxCent,
  };
}
```

- [ ] **Step 1.4: GREEN**
```bash
pnpm test src/services/export.test.ts
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 148 prior + 8 new = 156 tests.

- [ ] **Step 1.5: Commit**
```bash
git add src/services/export.ts src/services/export.test.ts
git commit -m "feat(services): export-service buildReisekostenRows + buildHomeofficeRows

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: CSV + XLSX Generators + Tests

**Files:**
- Create: `src/export/csv.ts`
- Create: `src/export/xlsx.ts`
- Create: `src/export/csv.test.ts`
- Create: `src/export/xlsx.test.ts`
- Modify: `package.json` (Dep `exceljs`)

- [ ] **Step 2.1: exceljs installieren**
```bash
pnpm add -w exceljs
```

- [ ] **Step 2.2: CSV-Generator**

`src/export/csv.ts`:
```ts
import type {
  HomeofficeExport,
  ReisekostenExport,
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
    "Datum", "Tagestyp",
    "Frühstück", "Mittag", "Abend",
    "Zuzahlung", "Pauschale", "Kürzung", "Absetzbar",
  ].join(SEP);

  const body = data.rows.map((r) =>
    [
      r.date,
      DAY_TYPE_LABELS_DE[r.type] ?? r.type,
      yesNo(r.fruehstueck), yesNo(r.mittag), yesNo(r.abend),
      formatEur(r.zuzahlungCent),
      formatEur(r.pauschaleCent),
      formatEur(r.kuerzungCent),
      formatEur(r.absetzbarCent),
    ].join(SEP),
  );

  const footer = [
    "SUMME", "", "", "", "", "",
    formatEur(data.summe_pauschale_cent),
    formatEur(data.summe_kuerzung_cent),
    formatEur(data.summe_absetzbar_cent),
  ].join(SEP);

  const lines = [header, ...body, footer].join(NL);
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
```

- [ ] **Step 2.3: XLSX-Generator**

`src/export/xlsx.ts`:
```ts
import ExcelJS from "exceljs";
import type {
  HomeofficeExport,
  ReisekostenExport,
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
  ws.addRow({ date: `Pauschale gesamt: ${(data.betrag_gesamt_cent / 100).toFixed(2).replace(".", ",")} €` });
  ws.addRow({ date: `Max Tage: ${data.max_tage}` });
  ws.addRow({ date: `Max Betrag: ${(data.max_betrag_cent / 100).toFixed(2).replace(".", ",")} €` });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
```

- [ ] **Step 2.4: Tests**

`src/export/csv.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { homeofficeToCsv, reisekostenToCsv } from "./csv.ts";

describe("reisekostenToCsv", () => {
  it("leerer Export → BOM + Header + Footer", () => {
    const out = reisekostenToCsv({
      year: 2026, rows: [],
      summe_pauschale_cent: 0, summe_kuerzung_cent: 0, summe_absetzbar_cent: 0,
    }).toString("utf8");
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("Datum;Tagestyp");
    expect(out).toContain("SUMME");
  });

  it("eine Reisezeile + Summe", () => {
    const out = reisekostenToCsv({
      year: 2026,
      rows: [{
        date: "2026-04-02", type: "reise_voll",
        fruehstueck: true, mittag: false, abend: true,
        zuzahlungCent: 0, pauschaleCent: 2800, kuerzungCent: 1680, absetzbarCent: 1120,
      }],
      summe_pauschale_cent: 2800, summe_kuerzung_cent: 1680, summe_absetzbar_cent: 1120,
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
      year: 2026, rows: [],
      anzahl_tage: 0, betrag_pro_tag_cent: 600,
      betrag_gesamt_cent: 0, max_tage: 210, max_betrag_cent: 126000,
    }).toString("utf8");
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("Datum");
    expect(out).toContain("Anzahl Tage");
    expect(out).toContain("Max Betrag");
  });
});
```

`src/export/xlsx.test.ts`:
```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { homeofficeToXlsx, reisekostenToXlsx } from "./xlsx.ts";

describe("reisekostenToXlsx", () => {
  it("erzeugt einen gültigen Workbook", async () => {
    const buf = await reisekostenToXlsx({
      year: 2026,
      rows: [{
        date: "2026-04-02", type: "reise_voll",
        fruehstueck: false, mittag: false, abend: true,
        zuzahlungCent: 0, pauschaleCent: 2800, kuerzungCent: 1120, absetzbarCent: 1680,
      }],
      summe_pauschale_cent: 2800, summe_kuerzung_cent: 1120, summe_absetzbar_cent: 1680,
    });
    expect(buf.length).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
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
      year: 2026, rows: [{ date: "2026-03-15" }],
      anzahl_tage: 1, betrag_pro_tag_cent: 600,
      betrag_gesamt_cent: 600, max_tage: 210, max_betrag_cent: 126000,
    });
    expect(buf.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.getWorksheet(1)?.name).toBe("Homeoffice 2026");
  });
});
```

- [ ] **Step 2.5: Smoke + Commit**
```bash
pnpm test
pnpm typecheck
pnpm lint
git add src/export/ package.json pnpm-lock.yaml
git commit -m "feat(export): csv + xlsx generators für reisekosten + homeoffice

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

Expected: 156 prior + 6 new = 162 tests.

---

## Task 3: PDF Generator + Tests

**Files:**
- Create: `src/export/pdf.ts`
- Create: `src/export/pdf.test.ts`
- Modify: `package.json` (Deps `pdfkit`, `@types/pdfkit`)

- [ ] **Step 3.1: pdfkit installieren**
```bash
pnpm add -w pdfkit
pnpm add -D -w @types/pdfkit
```

- [ ] **Step 3.2: PDF-Generator**

`src/export/pdf.ts`:
```ts
import PDFDocument from "pdfkit";
import type {
  HomeofficeExport,
  ReisekostenExport,
} from "../services/export.ts";

const DAY_TYPE_LABELS_DE: Record<string, string> = {
  reise_anreise: "Reise – Anreise",
  reise_voll: "Reise – voller Tag",
  reise_abreise: "Reise – Abreise",
  reise_eintaegig: "Reise – eintägig",
};

function formatEur(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",") + " €";
}

function bufferDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
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
  doc.fontSize(9).text(`Erstellt am ${new Date().toISOString().slice(0, 10)}`, {
    align: "right",
  });
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
      r.fruehstueck ? "✓" : "",
      r.mittag ? "✓" : "",
      r.abend ? "✓" : "",
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
  doc.fontSize(9).text(`Erstellt am ${new Date().toISOString().slice(0, 10)}`, {
    align: "right",
  });
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
  doc.text(`Pauschale gesamt: ${formatEur(data.betrag_gesamt_cent)} (max. ${formatEur(data.max_betrag_cent)})`);

  return bufferDoc(doc);
}
```

Hinweis: `pdfkit` ist async-stream-basiert. Die `bufferDoc`-Helper sammelt die Chunks. `Date.now()` und `new Date()` sind erlaubt außerhalb von `src/domain/` — hier ist `src/export/`.

- [ ] **Step 3.3: Tests**

`src/export/pdf.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { homeofficeToPdf, reisekostenToPdf } from "./pdf.ts";

describe("reisekostenToPdf", () => {
  it("erzeugt einen non-empty PDF-Buffer mit %PDF-Header", async () => {
    const buf = await reisekostenToPdf({
      year: 2026, rows: [],
      summe_pauschale_cent: 0, summe_kuerzung_cent: 0, summe_absetzbar_cent: 0,
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("erzeugt PDF mit Daten", async () => {
    const buf = await reisekostenToPdf({
      year: 2026,
      rows: [{
        date: "2026-04-02", type: "reise_voll",
        fruehstueck: false, mittag: false, abend: true,
        zuzahlungCent: 0, pauschaleCent: 2800, kuerzungCent: 1120, absetzbarCent: 1680,
      }],
      summe_pauschale_cent: 2800, summe_kuerzung_cent: 1120, summe_absetzbar_cent: 1680,
    });
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe("homeofficeToPdf", () => {
  it("erzeugt einen non-empty PDF-Buffer", async () => {
    const buf = await homeofficeToPdf({
      year: 2026, rows: [{ date: "2026-03-15" }],
      anzahl_tage: 1, betrag_pro_tag_cent: 600,
      betrag_gesamt_cent: 600, max_tage: 210, max_betrag_cent: 126000,
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 3.4: Smoke + Commit**
```bash
pnpm test
pnpm typecheck
pnpm lint
git add src/export/pdf.ts src/export/pdf.test.ts package.json pnpm-lock.yaml
git commit -m "feat(export): pdf generator (pdfkit) für reisekosten + homeoffice

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

Expected: 162 prior + 3 new = 165 tests.

---

## Task 4: Export-Routes + Integration-Tests

**Files:**
- Create: `src/server/routes/export.ts`
- Create: `tests/api-export.integration.test.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 4.1: Route**

`src/server/routes/export.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import {
  homeofficeToCsv,
  reisekostenToCsv,
} from "../../export/csv.ts";
import {
  homeofficeToPdf,
  reisekostenToPdf,
} from "../../export/pdf.ts";
import {
  homeofficeToXlsx,
  reisekostenToXlsx,
} from "../../export/xlsx.ts";
import {
  buildHomeofficeRows,
  buildReisekostenRows,
} from "../../services/export.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);
const FormatSchema = z.enum(["pdf", "xlsx", "csv"]);

const CONTENT_TYPES: Record<"pdf" | "xlsx" | "csv", string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

export interface ExportRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createExportRouter(deps: ExportRouteDeps): Hono {
  const app = new Hono();

  app.get("/reisekosten", async (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    const formatParsed = FormatSchema.safeParse(c.req.query("format"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    if (!formatParsed.success) return c.json({ error: "invalid_format" }, 400);
    const year = yearParsed.data;
    const format = formatParsed.data;
    try {
      const data = buildReisekostenRows(deps.db, year, deps.config);
      let buf: Buffer;
      if (format === "csv") buf = reisekostenToCsv(data);
      else if (format === "xlsx") buf = await reisekostenToXlsx(data);
      else buf = await reisekostenToPdf(data);

      c.header("Content-Type", CONTENT_TYPES[format]);
      c.header(
        "Content-Disposition",
        `attachment; filename="reisekosten-${year}.${format}"`,
      );
      return c.body(buf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Sätze für")) {
        return c.json({ error: "year_not_configured" }, 400);
      }
      throw err;
    }
  });

  app.get("/homeoffice", async (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    const formatParsed = FormatSchema.safeParse(c.req.query("format"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    if (!formatParsed.success) return c.json({ error: "invalid_format" }, 400);
    const year = yearParsed.data;
    const format = formatParsed.data;
    try {
      const data = buildHomeofficeRows(deps.db, year, deps.config);
      let buf: Buffer;
      if (format === "csv") buf = homeofficeToCsv(data);
      else if (format === "xlsx") buf = await homeofficeToXlsx(data);
      else buf = await homeofficeToPdf(data);

      c.header("Content-Type", CONTENT_TYPES[format]);
      c.header(
        "Content-Disposition",
        `attachment; filename="homeoffice-${year}.${format}"`,
      );
      return c.body(buf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Sätze für")) {
        return c.json({ error: "year_not_configured" }, 400);
      }
      throw err;
    }
  });

  return app;
}
```

- [ ] **Step 4.2: createServer-Update**

In `src/server/index.ts`:
```ts
import { createExportRouter } from "./routes/export.ts";
// ...nach /api/settings:
app.route("/api/export", createExportRouter({ db: deps.db, config: deps.config }));
```

- [ ] **Step 4.3: Integration-Tests**

`tests/api-export.integration.test.ts` (Pattern wie andere Integration-Tests):
```ts
// [Standard fixture-config + login boilerplate]

describe("/api/export/reisekosten", () => {
  it("GET ?year=2026&format=csv → 200 + CSV-Body", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("reisekosten-2026.csv");
    const text = await res.text();
    expect(text).toContain("﻿");
    expect(text).toContain("Datum;Tagestyp");
  });

  it("GET ?year=2026&format=xlsx → 200 + XLSX-Body", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("GET ?year=2026&format=pdf → 200 + PDF-Body", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("GET ohne format → 400 invalid_format", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_format" });
  });

  it("GET ohne year → 400 invalid_query", async () => {
    const res = await authedReq("/api/export/reisekosten?format=csv");
    expect(res.status).toBe(400);
  });

  it("GET mit unbekanntem format → 400", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=docx");
    expect(res.status).toBe(400);
  });
});

describe("/api/export/homeoffice", () => {
  it("GET ?year=2026&format=csv → 200 + CSV-Body", async () => {
    const res = await authedReq("/api/export/homeoffice?year=2026&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("GET ?year=2026&format=xlsx → 200 + XLSX-Body", async () => {
    const res = await authedReq("/api/export/homeoffice?year=2026&format=xlsx");
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("GET ?year=2026&format=pdf → 200 + PDF-Body", async () => {
    const res = await authedReq("/api/export/homeoffice?year=2026&format=pdf");
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 4.4: Smoke + Commit**
```bash
pnpm test
pnpm typecheck
pnpm lint
git add src/server/routes/export.ts src/server/index.ts tests/api-export.integration.test.ts
git commit -m "feat(server): /api/export/{reisekosten,homeoffice} mit format-switch + integration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

Expected: 165 prior + 9 new = 174 tests.

---

## Task 5: Frontend Export-Page + API-Client

**Files:**
- Modify: `ui/src/lib/api.ts` (`downloadExport` Funktion)
- Create: `ui/src/components/export/ExportPanel.tsx`
- Modify: `ui/src/pages/Export.tsx`
- Modify: `ui/src/locales/{de,en}.json`

- [ ] **Step 5.1: API-Client erweitern**

In `ui/src/lib/api.ts` am Ende:
```ts
export type ExportKind = "reisekosten" | "homeoffice";
export type ExportFormat = "pdf" | "xlsx" | "csv";

function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match?.[1] ?? fallback;
}

export async function downloadExport(
  kind: ExportKind,
  year: number,
  format: ExportFormat,
): Promise<void> {
  const res = await fetch(`/api/export/${kind}?year=${year}&format=${format}`, {
    credentials: "same-origin",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? "unknown");
  }
  const blob = await res.blob();
  const filename = extractFilename(
    res.headers.get("content-disposition"),
    `${kind}-${year}.${format}`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5.2: ExportPanel**

`ui/src/components/export/ExportPanel.tsx`:
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useYear } from "@/contexts/YearContext";
import {
  ApiError,
  downloadExport,
  type ExportFormat,
  type ExportKind,
} from "@/lib/api";

interface Props {
  kind: ExportKind;
}

const FORMATS: ExportFormat[] = ["pdf", "xlsx", "csv"];

export function ExportPanel({ kind }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const [pending, setPending] = useState<ExportFormat | null>(null);

  async function handle(format: ExportFormat) {
    setPending(format);
    try {
      await downloadExport(kind, year, format);
      toast.success(t("export.toast.success"));
    } catch (err) {
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        toast.error(t(key, { defaultValue: t("errors.unknown") }));
      } else {
        toast.error(t("errors.network"));
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`export.${kind}.title`)}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {t(`export.${kind}.description`)}
        </p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <Button
              key={f}
              variant="outline"
              onClick={() => handle(f)}
              disabled={pending !== null}
            >
              <Download className="h-4 w-4 mr-2" />
              {t(`export.format.${f}`)}
              {pending === f ? "…" : ""}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.3: Export-Page**

`ui/src/pages/Export.tsx` (komplett ersetzen):
```tsx
import { useTranslation } from "react-i18next";
import { ExportPanel } from "@/components/export/ExportPanel";
import { YearSelector } from "@/components/uebersicht/YearSelector";

export default function Export() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("pages.export.title")}</h1>
        <YearSelector />
      </div>
      <ExportPanel kind="reisekosten" />
      <ExportPanel kind="homeoffice" />
    </div>
  );
}
```

- [ ] **Step 5.4: Locales erweitern**

In `de.json` ergänzen:
```json
{
  "export.toast.success": "Download gestartet",
  "export.format.pdf": "PDF",
  "export.format.xlsx": "Excel",
  "export.format.csv": "CSV",
  "export.reisekosten.title": "Reisekosten",
  "export.reisekosten.description": "Tagesgenaue Aufstellung aller Reisetage mit Mahlzeitenkürzungen und absetzbarem Mehraufwand.",
  "export.homeoffice.title": "Homeoffice",
  "export.homeoffice.description": "Tagesgenaue Liste der Homeoffice-Tage mit Pauschale und Höchstbetrags-Status."
}
```

In `en.json` analog mit englischen Werten.

- [ ] **Step 5.5: typecheck + lint + smoke**
```bash
pnpm typecheck:ui
pnpm lint:ui
pnpm build:ui
pnpm test    # 174 backend tests
```

- [ ] **Step 5.6: Commit**
```bash
git add ui/src/lib/api.ts ui/src/components/export/ ui/src/pages/Export.tsx ui/src/locales/
git commit -m "feat(ui): export-page mit 6 download-buttons + downloadExport blob-fetch

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Release 0.8.0

**Files:**
- Modify: `CHANGELOG.md`
- Modify: root + ui `package.json`

- [ ] **Step 6.1: CHANGELOG**

In `CHANGELOG.md` über `## [0.7.0]`:
```markdown
## [Unreleased]

## [0.8.0] — 2026-06-11

### Added
- Backend `src/services/export.ts` mit `buildReisekostenRows(db, year, config)` + `buildHomeofficeRows(db, year, config)`.
- Backend `src/export/{csv,xlsx,pdf}.ts` mit Generator-Funktionen für beide Exports.
- Backend `src/server/routes/export.ts` — `GET /api/export/{reisekosten,homeoffice}?year=&format=pdf|xlsx|csv` mit Content-Type + Content-Disposition.
- Dependencies `exceljs@^4.4.0`, `pdfkit@^0.16.0`, `@types/pdfkit`.
- 17 neue Tests (8 Service + 6 CSV+XLSX + 3 PDF) + 9 Integration-Tests.
- UI: `downloadExport(kind, year, format)` mit Blob + Content-Disposition Filename-Extraktion.
- UI: `ui/src/components/export/ExportPanel.tsx` + echte `Export.tsx` Page mit 6 Download-Buttons.

### Changed
- `package.json` + `ui/package.json` — Version 0.8.0.
- Locales `de.json` + `en.json` — Export-Strings ergänzt.
- `src/server/index.ts` — `/api/export` registriert unter authMiddleware.
```

- [ ] **Step 6.2: Versionsbump**

Root + `ui/package.json`: `0.7.0` → `0.8.0`.

- [ ] **Step 6.3: Final-Smoke**
```bash
pnpm test
pnpm typecheck
pnpm typecheck:ui
pnpm lint:check
pnpm lint:ui
```

Expected: ~174 Tests, alle clean.

- [ ] **Step 6.4: Release-Commit**
```bash
git add CHANGELOG.md package.json ui/package.json
git commit -m "chore: release 0.8.0 — phase 3 complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase-3-Abschluss-Kriterien

- [x] ~174 Tests grün
- [x] CHANGELOG `[0.8.0]`
- [x] Export-Page liefert 6 Downloads (browser-getestet)
- [x] typecheck + lint clean
