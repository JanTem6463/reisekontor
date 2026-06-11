# Phase 1.B — CRUD-Routen + Service-Layer

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Implementierungsdokument v1.0](../../../../Reisekontor_Implementierungsdokument.docx), [Phase 1.A](2026-06-11-phase-1a-fundament-auth-design.md)
**Status:** Implementierungsbereit

## 1. Zweck dieser Phase

Phase 1.B liefert die CRUD-Routen für Tageseinträge, Reisen und Jahres-Kennzahlen — die fachliche Substanz der API. Ein Service-Layer trennt HTTP-Routen von DB-Calls und Domain-Math. Der in 1.A deferred Request-Logger wird jetzt eingehängt. Am Ende ist das Backend per `curl` voll testbar; UI in Phase 2 kann dagegen entwickeln.

`/api/checks` und `/api/settings` sind explizit aus dieser Phase ausgeklammert (siehe §2.2). Feiertags-Sync folgt in 1.C.

## 2. Scope

### Im Scope von Phase 1.B

- `src/services/` mit Pure-Function-Pattern (`(db, ...args) → result`):
  - `mappers.ts` — DB-Row ↔ Domain-`DayEntry`-Konversion
  - `days.ts` — `listForYear`, `upsert`, `delete`
  - `trips.ts` — `listForYear`, `create`, `update` (Hart-Reset), `delete`
  - `summary.ts` — `computeSummary` (Verpflegungssumme, HO-Tage/-Betrag, Reisetage nach Typ)
- Routen unter `src/server/routes/`:
  - `days.ts` — `GET /api/days?year`, `PUT /api/days/:date`, `DELETE /api/days/:date`
  - `trips.ts` — `GET /api/trips?year`, `POST /api/trips`, `PUT /api/trips/:id`, `DELETE /api/trips/:id`
  - `summary.ts` — `GET /api/summary?year`
- `src/server/middleware/request-logger.ts` — pino-basiert (method, path, status, duration_ms)
- `src/server/index.ts` aktualisiert (Routen registriert, Logger eingehängt)
- Unit-Tests für jeden Service mit `:memory:` SQLite
- Integration-Tests pro Endpoint-Gruppe in `tests/`
- CHANGELOG-Eintrag `[0.3.0] — 2026-06-11`

### Out of Scope für Phase 1.B

- `/api/checks` — Plausibilitätshinweise (Phase 1.C oder Phase 2; UI kann `plausibilitaet.checkAll()` direkt clientseitig nutzen, wenn nötig)
- `/api/settings` — Standardwoche/Bundesland-Override via DB (Phase 2 mit UI)
- Feiertags-Sync via `date-holidays`, `POST /api/holidays/sync` (Phase 1.C)
- Standardwochen-Auto-Generierung von HO-Day-Entries (UI-seitig in Phase 2 — Backend liefert nur explizite Einträge)
- UI

## 3. Architekturentscheidungen

### 3.1 Service-Layer als pure functions, nicht Klassen

`listDaysForYear(db, year): DayEntry[]`. `createTrip(db, input, rates): {trip, days}`. Tests injizieren `:memory:` DB plus Fixture-Rates. Keine globalen Service-Instanzen, keine DI-Container. Routes rufen die Service-Funktion direkt.

**Warum:** Folgt dem Phase-0-Pattern (Domain-Funktionen sind pure). Die einzige Mutation ist die DB; alle anderen Daten fließen durch.

### 3.2 DB-Row ↔ Domain-DayEntry Mapping in `mappers.ts`

Drizzle gibt Camel-Case-Felder zurück, aber das `meals`-Objekt ist in der DB flach (`fruehstueck`, `mittag`, `abend` als Spalten). `mappers.toDomainDay(row)` bündelt: `{date, type, homeoffice, meals: {fruehstueck, mittag, abend}, zuzahlungCent}`. `mappers.toDbDay(domain)` reverse für Inserts.

**Warum:** Domain-Engine kennt nur `DayEntry` mit `meals`-Objekt. Mapper ist die einzige Stelle, an der die DB-Spalten-Form vorkommt — sonst müssten Tests + Routes überall die flache Form kennen.

### 3.3 Transaktionale Trip-Operationen via Drizzle

`POST /api/trips` ruft `classifyTrip()` aus der Domain, dann in einer Drizzle-`transaction()`:
1. Insert trip → erhalte `newId`
2. Insert N day_entries mit `tripId = newId`
3. Commit

Bei Fehler in Schritt 2 (z. B. PRIMARY-KEY-Konflikt auf `day_entries.date` weil schon ein Eintrag existiert) → Rollback → Route returnt 409.

`PUT /api/trips/:id` (Hart-Reset, vom User bestätigt):
1. Delete `day_entries` where `trip_id = id` (auch manuell gepflegte Mahlzeiten gehen verloren)
2. classifyTrip(neue Eingabe) → newDays
3. Update trip-Row (startDate, endDate, uebernachtung)
4. Insert newDays mit `tripId = id`
5. Commit

`DELETE /api/trips/:id`:
1. Delete `day_entries` where `trip_id = id`
2. Delete trip where `id = id`
3. Commit

### 3.4 `year` ist required Query-Param für alle List-Endpoints

Zod: `z.coerce.number().int().min(2020).max(2100)`. Fehlt der Param oder ist ungültig → 400. Die DB hat ein `year`-Feld auf `day_entries` und `trips` (für Index-Lookups; SQLite ohne Year-Index ist auch ok bei wenigen Zeilen).

### 3.5 Backend liefert nur explizite Day-Entries

GET /api/days?year= gibt NUR Zeilen aus der DB. Standardwochen-Default (automatisches HO) ist UI-Logik in Phase 2. Vorteil: Backend bleibt deterministisch und testbar, keine implizite Generierung.

### 3.6 PUT /api/days/:date Semantik

Komplexer als naive UPSERT, weil Reisetage und Kombi-Tage Sonderbehandlung brauchen.

**Regeln:**
- Wenn kein Eintrag existiert UND `type ∈ {reise_anreise, reise_voll, reise_abreise, reise_eintaegig}` → **400** `"reise_type_via_trips"`. Reisetage werden über `POST /api/trips` erzeugt.
- Wenn ein Eintrag existiert mit `type ∈ {reise_*}` UND body.type unterscheidet sich → **400** `"type_locked_for_trip_day"`.
- Wenn ein Eintrag existiert mit `tripId !== null` UND `body.tripId !== existingTripId` (oder body.tripId fehlt) → **400** `"trip_id_locked"`.
- Alle anderen Felder (`homeoffice`, `meals`, `zuzahlungCent`) sind frei änderbar — das ist genau, wie Kombi-Tage (Anreise + HO=true) und Mahlzeiten-Markierungen funktionieren.

**Implementation:** Service `upsertDay(db, dayEntry): {created: boolean}` macht den UPSERT; die Route prüft die Regeln vorher gegen den existierenden Eintrag (falls vorhanden).

### 3.7 DELETE /api/days/:date

Löscht den expliziten Eintrag. Wenn der Eintrag ein Reisetag war → 400 `"reise_day_via_trip"` (User muss die Reise löschen oder ändern, um den Reisetag zu entfernen).

### 3.8 `/api/summary` aggregiert pure functions der Domain-Engine

Liest alle `day_entries` und `trips` des Jahres, konvertiert via Mapper zu Domain-Form, ruft:
- `homeofficePauschaleCent(days, rates)` → HO-Betrag
- `homeofficeTage(days)` → HO-Tage-Anzahl
- Für jeden Reisetag `verpflegungProTagCent(day, rates)` → summieren → Verpflegungssumme
- Group-by `type` über alle Tage → Reisetage-nach-Typ
- Count trips → Reisen-Anzahl

Response-Shape:
```ts
{
  year: number;
  verpflegungSummeCent: number;
  kuerzungSummeCent: number;       // sum of kuerzungCent over all Reisetage
  homeofficeTage: number;
  homeofficeMaxTage: number;       // aus config.raw.jahre[year].homeoffice_max_tage
  homeofficeBetragCent: number;
  homeofficeMaxBetragCent: number; // aus rates.homeofficeMaxCent
  reisetageNachTyp: {
    reise_anreise: number;
    reise_voll: number;
    reise_abreise: number;
    reise_eintaegig: number;
  };
  reisenAnzahl: number;
}
```

`homeofficeMaxTage` (210) wird hier zum ersten Mal angefasst — das ist der Use-Case, der in 1.A bewusst aufgeschoben wurde (Memory `project_reisekontor_progress.md` Gotcha). Service liest es direkt aus `config.raw.jahre[year].homeoffice_max_tage`.

### 3.9 `ServerDeps` bekommt kein neues Feld

Routes rufen `deps.config.ratesForYear(year)` pro Request — der Year-Param ist die natürliche Achse. Keine Caching-Optimierung nötig (Config ist immutable seit Boot).

### 3.10 Request-Logger via Custom Hono-Middleware

Erste Middleware in `createServer`, vor `app.route("/api/auth", ...)`. Loggt jeden Request mit `method`, `path`, `status`, `duration_ms`. Nutzt `appLogger.info()` (pino). 401/404 werden mitgeloggt; das ist gewollt für Audit.

**Warum nicht `hono/logger`:** Das eingebaute schreibt auf `console.log`, nicht in unser strukturiertes pino-Format mit Redaction.

### 3.11 Fehler-Codes

| Status | Code | Wann |
|---|---|---|
| 400 | `invalid_body` | Zod-Schema-Fehler im JSON-Body |
| 400 | `invalid_query` | Year-Param fehlt oder ungültig |
| 400 | `reise_type_via_trips` | PUT /days versucht reise_* anzulegen |
| 400 | `type_locked_for_trip_day` | PUT /days will Reisetyp ändern |
| 400 | `trip_id_locked` | PUT /days will trip_id ändern |
| 400 | `reise_day_via_trip` | DELETE /days auf einem Reisetag |
| 400 | `invalid_trip_dates` | classifyTrip wirft (überdeckt eintägig+Übernachtung, endDate<startDate, mehrtägig ohne Übernachtung) |
| 404 | `not_found` | Trip oder Day-Entry nicht gefunden |
| 409 | `date_conflict` | INSERT day_entries kollidiert mit existierendem PK |

## 4. Konzeptionelles Schnittstellen-Design

### 4.1 Mappers (`src/services/mappers.ts`)

```ts
import type { DayEntry, DayType } from "../domain/types.ts";
import type { dayEntries } from "../db/schema.ts";

type DbDayRow = typeof dayEntries.$inferSelect;
type DbDayInsert = typeof dayEntries.$inferInsert;

export function toDomainDay(row: DbDayRow): DayEntry;
export function toDbDayInsert(domain: DayEntry, year: number, tripId: number | null): DbDayInsert;
```

### 4.2 Days Service (`src/services/days.ts`)

```ts
export function listForYear(db: Db, year: number): DbDayRow[];
export function get(db: Db, date: string): DbDayRow | null;
export function upsert(db: Db, row: DbDayInsert): { created: boolean };
export function deleteByDate(db: Db, date: string): { deleted: boolean };
```

### 4.3 Trips Service (`src/services/trips.ts`)

```ts
export interface TripWithDays {
  trip: typeof trips.$inferSelect;
  days: DbDayRow[];
}

export function listForYear(db: Db, year: number): TripWithDays[];
export function get(db: Db, id: number): TripWithDays | null;
export function create(db: Db, input: TripInput): TripWithDays;
export function update(db: Db, id: number, input: TripInput): TripWithDays | null;
export function deleteById(db: Db, id: number): { deleted: boolean };
```

`create()` und `update()` wickeln `classifyTrip()` + DB-Operationen in `db.transaction(...)` ab. `classifyTrip` wirft → Transaction nicht gestartet → Route returnt 400. SQL-Konflikt im Insert → Transaction rollt zurück → Service propagiert den Fehler → Route returnt 409.

### 4.4 Summary Service (`src/services/summary.ts`)

```ts
export interface YearSummary {
  year: number;
  verpflegungSummeCent: number;
  kuerzungSummeCent: number;
  homeofficeTage: number;
  homeofficeMaxTage: number;
  homeofficeBetragCent: number;
  homeofficeMaxBetragCent: number;
  reisetageNachTyp: Record<"reise_anreise" | "reise_voll" | "reise_abreise" | "reise_eintaegig", number>;
  reisenAnzahl: number;
}

export function computeSummary(db: Db, year: number, config: AppConfig): YearSummary;
```

Liest day_entries + trips für das Jahr, konvertiert via Mapper, ruft Domain-Engine, summiert. Wirft, wenn `config.ratesForYear(year)` wirft.

### 4.5 Request-Logger (`src/server/middleware/request-logger.ts`)

```ts
export function requestLogger(): MiddlewareHandler;
// loggt {method, path, status, duration_ms} nach jedem Request
```

### 4.6 Routen — JSON-Schemas

`PUT /api/days/:date` Body:
```ts
{
  type: DayType;
  homeoffice?: boolean;          // default false
  tripId?: number | null;        // muss bei existing trip-day mit existierendem matchen
  meals?: { fruehstueck?, mittag?, abend? };  // alle default false
  zuzahlungCent?: number;        // default 0
}
```

`POST /api/trips` Body:
```ts
{
  startDate: string;             // ISO YYYY-MM-DD
  endDate: string;
  uebernachtung: boolean;
}
```

`PUT /api/trips/:id` Body: gleich wie POST.

`GET /api/trips?year=` Response:
```ts
Array<{
  trip: { id, year, startDate, endDate, uebernachtung };
  days: Array<DbDayRow>;        // mit homeoffice, meals, zuzahlungCent
}>
```

`GET /api/summary?year=` Response: siehe §4.4.

## 5. Test-Strategie

### 5.1 Service-Unit-Tests (Pflicht)

`src/services/days.test.ts`:
- `listForYear(emptyDb, 2026)` → `[]`
- `upsert(db, newRow)` → `{created: true}`
- `upsert(db, existingDate)` → `{created: false}`, Werte überschrieben
- `deleteByDate(db, missing)` → `{deleted: false}`
- `deleteByDate(db, existing)` → `{deleted: true}`

`src/services/trips.test.ts`:
- `create` mit 3-Tages-Reise mit Übernachtung → Trip + 3 Day-Entries (anreise + voll + abreise)
- `create` mit eintägiger Reise → 1 Day-Entry reise_eintaegig
- `create` mit ungültiger TripInput (z. B. eintägig + Übernachtung) → wirft (Route fängt)
- `create`, wenn ein Day-Datum schon existiert → wirft (Route fängt → 409)
- `update` (Hart-Reset) → alte Day-Entries weg, neue da, manuelle Mahlzeiten verloren
- `delete` → Trip + Day-Entries weg
- `listForYear` → trips + days korrekt gruppiert

`src/services/summary.test.ts`:
- leeres Jahr → 0/0/0
- Jahr mit 1 Anreise + 1 voller Tag + 1 Abreise, keine Mahlzeiten → 14+28+14 = 56€, 0 HO-Tage
- Jahr mit 211 HO-Tagen → 1260€ Deckel
- Jahr mit Urlaub/Krankheit/Feiertag → diese nicht im HO-Zähler

### 5.2 Integration-Tests

Drei separate Dateien in `tests/`:
- `api-days.integration.test.ts` — Login, GET leer, PUT homeoffice, GET zeigt 1, PUT urlaub (Overwrite), DELETE, GET zeigt 0, PUT mit reise_anreise → 400, PUT mit invalid body → 400
- `api-trips.integration.test.ts` — POST mit gültiger Reise → 200 + erzeugte Days, GET listet, PUT Hart-Reset, DELETE, POST mit invalid input → 400, POST mit Date-Konflikt → 409, GET mit invalid year → 400
- `api-summary.integration.test.ts` — komplettes Jahres-Szenario: 5 HO-Tage + 1 Reise → Summary korrekt

### 5.3 Erwartete Test-Anzahl

| Modul | Tests |
|---|---|
| Days Service | ~6 |
| Trips Service | ~8 |
| Summary Service | ~5 |
| Mappers (separat oder im Days-Service) | ~3 |
| Days Integration | ~7 |
| Trips Integration | ~7 |
| Summary Integration | ~3 |

≈ 39 neue Tests. Gesamt 77 (1.A) + 39 = ~116.

## 6. Konfiguration

Keine neuen ENV-Vars. Keine Schema-Änderung an `config/app.yaml`.

## 7. Abschluss-Kriterien Phase 1.B

- [ ] `pnpm dev` startet wie zuvor; Request-Logger erscheint im stdout
- [ ] Alle 9 neuen Endpoints reagieren wie spezifiziert (manueller curl-Smoke am Ende)
- [ ] `pnpm test` → ~116 Tests grün
- [ ] `pnpm typecheck` und `pnpm lint:check` → grün
- [ ] CHANGELOG `[0.3.0] — 2026-06-11`
- [ ] Commit-Historie auf `main`

## 8. Nächste Phase

Phase 1.C: Feiertags-Sync via `date-holidays`, `POST /api/holidays/sync?year=`, automatische Generierung von `type: feiertag` Day-Entries für das Bundesland aus der Config. Plus `/api/checks` für Plausibilitätshinweise (wrappt `plausibilitaet.checkAll()`).
