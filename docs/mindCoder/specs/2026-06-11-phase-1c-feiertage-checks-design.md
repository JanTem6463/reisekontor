# Phase 1.C — Feiertags-Sync + Plausibilitäts-Checks

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Implementierungsdokument v1.0](../../../../Reisekontor_Implementierungsdokument.docx), [Phase 1.B](2026-06-11-phase-1b-crud-design.md)
**Status:** Implementierungsbereit

## 1. Zweck dieser Phase

Phase 1.C schließt die Backend-CRUD-Welle ab: `POST /api/holidays/sync?year=` legt automatisch die gesetzlichen Feiertage des konfigurierten Bundeslandes als `feiertag`-Day-Entries an. `GET /api/checks?year=` liefert Plausibilitäts-Hinweise als JSON-Array. Damit ist das Backend für die UI-Entwicklung in Phase 2 vollständig vorbereitet.

## 2. Scope

### Im Scope

- Neue Dependency: `date-holidays`
- `src/services/holidays.ts` — `syncHolidaysForYear(db, year, bundesland)`
- `src/services/checks.ts` — Wrapper um `plausibilitaet.checkAll()` der Domain
- `src/server/routes/holidays.ts` — `POST /api/holidays/sync?year=`
- `src/server/routes/checks.ts` — `GET /api/checks?year=`
- Service-Unit-Tests + Integration-Tests
- CHANGELOG `[0.4.0] — 2026-06-11`

### Out of Scope

- Auto-Sync beim Jahreswechsel (UI in Phase 2 triggert manuell)
- `/api/settings` für Bundesland-Override via DB (Phase 2)
- UI (Phase 2)
- Export, Docker, Deploy (Phasen 3 + 4)

## 3. Architekturentscheidungen

### 3.1 Sync-Semantik: Cleanup + Idempotent + User-Override

```
1. Lösche alle day_entries des Jahres mit type=feiertag
   (Cleanup; macht Bundesland-Wechsel und sync-Replays sauber)
2. Hole gesetzliche Feiertage des Bundeslandes aus date-holidays
3. Für jeden Feiertag:
   - get day_entry für das Datum
   - existiert nicht → INSERT type=feiertag
   - existiert mit non-feiertag-Type → SKIP (User-Override gewinnt)
4. Response: {year, bundesland, created, skipped: Array<{date, reason}>}
```

**Warum:** Ein einmaliges Löschen aller existing `feiertag`-Einträge garantiert Idempotenz und Bundesland-Wechsel-Sauberkeit. Konflikte mit User-Overrides (Urlaub, Krankheit, Reise) werden explizit zurückgemeldet, nicht überschrieben.

### 3.2 Bundesland aus Config, nicht aus Request

`config.raw.feiertage.bundesland` (Default `NI`). Der Sync-Endpoint hat nur `year` als Param. Wenn der User später das Bundesland ändert (Phase 2), wird neu gesynct.

### 3.3 `date-holidays`-Filter auf `type: 'public'`

`new Holidays('DE', bundesland).getHolidays(year)` liefert eine Liste mit Feiertagen unterschiedlicher Typen. Wir filtern auf `type === 'public'` — gesetzliche Feiertage. Das deckt z. B. NI 2026 mit 9 Feiertagen ab (Neujahr, Karfreitag, Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, Tag der Deutschen Einheit, Reformationstag, 1./2. Weihnachtstag — variiert pro Bundesland).

Date-Format aus `date-holidays`: `2026-12-25 00:00:00` mit Zeitzone — wir nehmen die ersten 10 Zeichen via `slice(0, 10)`. Kein Timezone-Drift, da wir nur den Datumsteil brauchen.

### 3.4 `/api/checks` ist reine Lesefunktion

Service `checks.ts` exportiert `checkYear(db, year): PlausibilitaetHinweis[]`. Liest day_entries des Jahres, mappt via `toDomainDay`, ruft `plausibilitaet.checkAll(days)`. Keine DB-Mutation. Die Code-Strings (`DOPPEL_HO_REISE_VOLL` etc.) sind die i18n-Schlüssel, die in Phase 2 vom UI übersetzt werden.

### 3.5 Versionsbump 0.4.0

Semantic Versioning: zwei neue API-Endpoints + neue Dependency = Minor-Bump.

## 4. Schnittstellen-Design

### 4.1 Holidays Service

```ts
export interface HolidaysSyncResult {
  year: number;
  bundesland: string;
  created: number;
  skipped: Array<{ date: string; existingType: string }>;
}

export function syncHolidaysForYear(
  db: Db,
  year: number,
  bundesland: string,
): HolidaysSyncResult;
```

### 4.2 Checks Service

```ts
export function checkYear(db: Db, year: number): PlausibilitaetHinweis[];
```

`PlausibilitaetHinweis` aus `src/domain/plausibilitaet.ts` — re-export oder direkter Import.

### 4.3 Routen

```
POST /api/holidays/sync?year=2026
  Body: leer
  200: { year, bundesland, created, skipped }
  400: invalid_query (year fehlt/außerhalb)

GET /api/checks?year=2026
  200: Array<{ code, date, schwere }>
  400: invalid_query
```

## 5. Test-Strategie

### 5.1 Holidays Service Tests

- `syncHolidaysForYear(emptyDb, 2026, "NI")` → `created >= 9`, `skipped: []`
- Zweiter Sync → `created: 0` (alle existieren), `skipped: []` (vorhandene feiertag-Einträge wurden vorher gelöscht)
- Existing Urlaub auf 2026-05-01 → `created: 8`, `skipped: [{date: "2026-05-01", existingType: "urlaub"}]`
- Sync mit ungültigem Bundesland (z. B. `"XX"`) → wirft mit klarer Message
- Sync löscht alte feiertag-Einträge, die nicht mehr in der Liste sind (z. B. nach Bundesland-Wechsel)

### 5.2 Checks Service Tests

- Leeres Jahr → `[]`
- Tag mit `reise_voll + homeoffice=true` → enthält `DOPPEL_HO_REISE_VOLL`
- Tag mit `homeoffice` → enthält `HO_KONFLIKT_ENTFERNUNG`

### 5.3 Integration-Tests

- `POST /api/holidays/sync?year=2026` → 200 mit `created >= 9`
- `POST /api/holidays/sync` (ohne year) → 400
- `GET /api/checks?year=2026` → 200 mit Array

Erwartete Test-Anzahl: 120 (1.B) + ~14 = ~134.

## 6. Konfiguration

Keine neuen ENV-Vars. `config/app.yaml`-Schema unverändert.

## 7. Abschluss-Kriterien

- `pnpm dev` startet wie zuvor
- `curl -X POST --cookie ... 'http://localhost:3030/api/holidays/sync?year=2026'` → 200 mit Feiertagsliste
- `curl --cookie ... 'http://localhost:3030/api/checks?year=2026'` → 200 mit Hinweis-Array
- `pnpm test` → ~134 grün
- CHANGELOG `[0.4.0] — 2026-06-11`

## 8. Nächste Phase

Phase 2: UI mit Vite + React + shadcn/ui + react-i18next (DE/EN) + Dark Mode. UI-Workspace `ui/` mit eigenem Build. `/api/settings` für UI-Bedarfe (Standardwoche-Override, Bundesland-Wechsel).
