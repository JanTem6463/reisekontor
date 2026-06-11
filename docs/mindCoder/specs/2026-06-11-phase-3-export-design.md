# Phase 3 — Export (PDF + Excel + CSV)

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Anforderungsdokument §5.9 FA-29..FA-32](../../../../Reisekontor_Anforderungsdokument.docx), [Implementierungsdokument §3 (Tech-Stack)](../../../../Reisekontor_Implementierungsdokument.docx)
**Status:** Implementierungsbereit

## 1. Zweck

Phase 3 liefert prüffähige Auswertungen für den Steuerberater: zwei Endpoints `GET /api/export/reisekosten?year=&format=` und `GET /api/export/homeoffice?year=&format=` in den Formaten PDF, Excel (XLSX) und CSV. Plus Frontend-Export-Seite mit Format-Auswahl und Download-Triggern.

## 2. Scope

### Im Scope

**Backend:**
- `src/services/export.ts` — `buildReisekostenRows(db, year, config)` + `buildHomeofficeRows(db, year, config)` + Aggregations-Metadaten
- `src/export/{csv,xlsx,pdf}.ts` — Format-Generatoren
- `src/server/routes/export.ts` — 2 Endpoints mit format-Switch
- Dependencies: `pdfkit`, `exceljs`, `@types/pdfkit`
- Service-Tests + Format-Tests + Integration-Tests

**UI:**
- API-Client: `downloadExport(kind, year, format)` mit Blob-Response + Filename aus Content-Disposition
- `ui/src/components/export/{ReisekostenPanel,HomeofficePanel}.tsx`
- `ui/src/pages/Export.tsx` als echte Seite
- Locales DE+EN um Export-Strings

**Release 0.8.0**

### Out of Scope

- DATEV-Format (Implementierungsdok §19: optional, später)
- E-Mail-Versand der Exports (kein Spec-Item)
- ZIP-Bundle für mehrere Formate auf einmal
- Backend-seitiges Caching der generierten Files
- UI-Vorschau ohne Download

## 3. Architekturentscheidungen

### 3.1 Library-Wahl: pdfkit + exceljs + native CSV

- **PDF: pdfkit@^0.16.0** — Mature, kein Headless-Browser-Overhead, dokumentationsstark für tabellarische Daten. Alternative `pdf-lib` wäre für Edit-Workflows besser, hier irrelevant.
- **XLSX: exceljs@^4.4.0** — Volle Feature-Set: gefettete Headers, Currency-Cell-Format, Column-Width, native SUM-Formeln. Alternative `xlsx` (SheetJS) hat Lizenz-Komplexität (CE/Pro-Split) und weniger Style-Features.
- **CSV: native** — kein Lib. Format = `;` separator (deutsche Excel-Default) + UTF-8 BOM (damit Excel Umlaute richtig liest) + deutsche Komma-Geldnotation.

### 3.2 Daten-Aggregation im Service-Layer

Reine Funktionen (`buildReisekostenRows`/`buildHomeofficeRows`) liefern strukturierte Row-Objekte. Format-Generatoren konsumieren diese — kein direkter DB-Zugriff in Generatoren.

```ts
interface ReisekostenRow {
  date: string;
  type: DayType;
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungCent: number;
  kuerzungCent: number;
  pauschaleCent: number;     // Brutto-Pauschale vor Kürzung
  absetzbarCent: number;     // Nach Kürzung — der relevante Wert
}

interface ReisekostenExport {
  year: number;
  rows: ReisekostenRow[];
  summe_pauschale_cent: number;
  summe_kuerzung_cent: number;
  summe_absetzbar_cent: number;
}

interface HomeofficeRow {
  date: string;
}

interface HomeofficeExport {
  year: number;
  rows: HomeofficeRow[];
  anzahl_tage: number;
  betrag_pro_tag_cent: number;
  betrag_gesamt_cent: number;   // mit 1.260€-Deckel
  max_tage: number;
  max_betrag_cent: number;
}
```

Alle Berechnungen rufen die existing Domain-Funktionen (`verpflegungProTagCent`, `kuerzungCent`, `homeofficePauschaleCent`) — keine Re-Implementierung in der Export-Schicht.

### 3.3 Generator-Signaturen

```ts
// CSV
export function reisekostenToCsv(data: ReisekostenExport): Buffer;
export function homeofficeToCsv(data: HomeofficeExport): Buffer;

// XLSX
export async function reisekostenToXlsx(data: ReisekostenExport): Promise<Buffer>;
export async function homeofficeToXlsx(data: HomeofficeExport): Promise<Buffer>;

// PDF
export function reisekostenToPdf(data: ReisekostenExport): Promise<Buffer>;
export function homeofficeToPdf(data: HomeofficeExport): Promise<Buffer>;
```

Alle returnen `Buffer` — Routes setzen Content-Type + senden raw.

### 3.4 CSV-Konvention

- Separator: `;`
- UTF-8 BOM (`﻿`) am Anfang — damit Excel Umlaute parsed
- Datumsformat: ISO `YYYY-MM-DD`
- Geld: deutsche Komma-Notation OHNE €-Symbol (`14,00` statt `14,00 €`) — bessere Maschinen-Lesbarkeit
- Boolean: `Ja` / `Nein`
- Tagestyp: deutscher Klartext (`Reise – Anreise`)
- Header-Zeile + Footer-Zeile mit Summen

Reisekosten-Spalten: `Datum;Tagestyp;Frühstück;Mittag;Abend;Zuzahlung;Pauschale;Kürzung;Absetzbar`
Homeoffice-Spalten: `Datum`

### 3.5 XLSX-Layout

- Sheet-Name: `Reisekosten 2026` / `Homeoffice 2026`
- Header-Row: bold, hellgrauer Hintergrund (`FFE5E5E5`)
- Datums-Cells: `string`-Format (ISO) — Excel formatiert auf User-Wunsch
- Geld-Cells: `numFmt: "#,##0.00 €"` (Excel rendert mit User-Locale)
- Summen-Row: bold + `SUM()`-Formel über die jeweiligen Spalten
- Column-Width: auto-fit basierend auf längstem Inhalt + Header
- Hinweis-Zeilen über dem Header für Reisekosten: „Jahr: 2026 | Erstellt am: 2026-06-11"

### 3.6 PDF-Layout

- A4 Portrait, 30pt Margins
- Header (Seite 1): Titel groß, Steuerjahr + Erstellungs-Datum
- Tabelle: Grid mit Linien, Header-Row gefettet
- Page-Break: bei Erreichen des Page-Bottom neuer Page + Header-Row repeat
- Footer (letzte Seite): Summen-Zeile gefettet
- Page-Number unten rechts auf jeder Seite
- Font: Helvetica (in pdfkit gebundled, keine externe Font-Datei nötig)

### 3.7 Route-Design

```
GET /api/export/reisekosten?year=2026&format=pdf|xlsx|csv
  Auth: required
  Validation: Zod (year + format enum)
  Response:
    200 + Content-Type + Content-Disposition: attachment; filename="reisekosten-2026.{ext}" + raw Buffer
    400 invalid_query / invalid_format
    400 year_not_configured (wenn config.ratesForYear wirft)

GET /api/export/homeoffice?year=2026&format=pdf|xlsx|csv
  // analog
```

Content-Types:
- `text/csv; charset=utf-8`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/pdf`

### 3.8 Frontend-Download via Blob

Da `request<T>` aus `lib/api.ts` JSON-spezifisch ist, brauchen wir eine separate Funktion:

```ts
export async function downloadExport(
  kind: "reisekosten" | "homeoffice",
  year: number,
  format: "pdf" | "xlsx" | "csv",
): Promise<void>;
```

Implementierung: `fetch` mit `credentials: "same-origin"`, bei 200 → blob extrahieren, Filename aus `Content-Disposition` parsen, `<a download>` Click triggern, ObjectURL revoken nach Click. Bei Fehler → `toast.error`.

### 3.9 Versionsbump 0.8.0

Komplette neue Funktions-Schicht → Minor.

## 4. Datenmodell-Detail

### 4.1 Reisekosten-Berechnung pro Reisetag

Für jeden Day-Entry mit `type ∈ {reise_anreise, reise_voll, reise_abreise, reise_eintaegig}`:
- `pauschaleCent`: basierend auf type (kleine=1400 oder grosse=2800 Cent)
- `kuerzungCent`: aus `kuerzungCent(meals, rates) - zuzahlungCent`, gefloort auf 0
- `absetzbarCent`: aus `verpflegungProTagCent(day, rates)` — schon mit Floor 0

`buildReisekostenRows` ruft die Domain-Funktionen und merged in den Row.

### 4.2 Homeoffice-Aggregation

`buildHomeofficeRows` filtert `daysService.listForYear(year)` auf Homeoffice-Logik (gleich wie `homeofficeTage`-Domain-Funktion — homeoffice-only ODER reise_anreise/abreise mit homeoffice=true). Jeder Row = nur ein Datum. Footer-Metadaten via `homeofficePauschaleCent`.

## 5. Tests

### 5.1 Service-Tests

`src/services/export.test.ts`:
- `buildReisekostenRows` mit leerer DB → 0 Rows, alle Summen 0
- 3-Tages-Reise (anreise+voll+abreise) ohne Mahlzeiten → 3 Rows mit 1400+2800+1400=5600 absetzbar
- Voller Tag mit Frühstück+Abend → kuerzung=1680, absetzbar=1120
- `buildHomeofficeRows` mit 5 HO + 1 Urlaub + 1 Krankheit → 5 Rows, Urlaub/Krankheit exclude
- 215 HO-Tage → 215 Rows aber Betrag-Footer auf 126000 cent gefloort

### 5.2 Generator-Tests

- CSV: string-compare gegen Fixture
- XLSX: Workbook lesbar, `getWorksheet(1)`-rowCount > 0, Header-Row hat bold-style
- PDF: Buffer non-empty, beginnt mit `"%PDF-"`, Größe > 1000 Bytes

### 5.3 Integration-Tests

- GET reisekosten (csv|xlsx|pdf) → 200 + korrekter Content-Type + Content-Disposition + non-empty body
- GET homeoffice (csv|xlsx|pdf) → 200 + analog
- GET ohne year → 400
- GET mit format=zip → 400

Erwartet: 148 (Backend) + ~15 = ~163 Tests.

### 5.4 Manueller Smoke

Im Browser: Login → Export-Seite → 6 Download-Buttons (2 Exports × 3 Formate). Öffnen der Downloads in Excel/PDF-Viewer prüft Layout.

## 6. Konfiguration

Keine neuen ENV-Vars. `config/app.yaml` unverändert.

## 7. Abschluss-Kriterien

- [ ] `pnpm test` → ~163 Tests grün
- [ ] `pnpm typecheck` + `pnpm typecheck:ui` + `pnpm lint:check` + `pnpm lint:ui` grün
- [ ] `pnpm build:ui` grün
- [ ] Browser-Smoke: Export-Seite → 6 Downloads klappen, Files öffnen in Excel/PDF-Viewer ohne Fehler
- [ ] CHANGELOG `[0.8.0]`

## 8. Nächste Phase

Phase 4: Docker-Container + Caddy-Eintrag + Hetzner-Deploy unter `reisen.jans-Claude-Apps.de` + GitHub Actions CI/CD + Backup-Cron. Vorbild: `finanz-app` (`hetzner-deploy-finanz`).
