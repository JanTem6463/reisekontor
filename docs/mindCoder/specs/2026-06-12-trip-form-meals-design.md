# Trip-Form mit Mahlzeiten-Eingabe

**Datum:** 2026-06-12
**Projekt:** Reisekontor (post-deploy UX-Iteration)
**Grundlage:** User-Feedback nach Produktiv-Login

## 1. Zweck

Aktuell muss der User nach `POST /api/trips` jeden erzeugten Reisetag einzeln in der Übersicht aufrufen, um Mahlzeiten und Zuzahlung zu pflegen. Diese Iteration erlaubt die Eingabe direkt im Reisen-Anlege-Dialog (und im Edit-Dialog) — eine Tabelle aller berechneten Reisetage erscheint live im Dialog, sobald Datums-Range + Übernachtung gültig sind.

## 2. Scope

### Im Scope

- Backend: `POST /api/trips` und `PUT /api/trips/:id` body um optionales `days: Array<{date, fruehstueck?, mittag?, abend?, zuzahlungCent?, homeoffice?}>` erweitert. Backward-compatible (Default `[]` → bisheriges Verhalten).
- Backend Service `tripsService.create`/`update` bekommen optionales `dayOverrides`-Argument; verarbeiten es nach `classifyTrip`.
- Service-Unit-Tests: dayOverrides werden korrekt angewendet; non-matching Daten werden ignored; backward-compat ohne Argument.
- Integration-Tests pro Endpoint: 200 mit days-Array; existing-Pfad ohne days unverändert.
- UI: `ui/src/lib/trip-preview.ts` mit `classifyTripPreview(startDate, endDate, uebernachtung) → ClassifiedDay[] | null` (10-Zeilen-Port der Backend-Logik, gleiche deterministische Regeln).
- `ReiseFormDialog` erweitert um Per-Tag-Tabelle:
  - Spalten: Datum, Typ (read-only), Frühstück / Mittag / Abend (Checkboxes), Zuzahlung € (Input), Homeoffice (Checkbox, nur bei anreise/abreise)
  - Edit-Modus: existing-Werte pre-fillen
  - Empty/Invalid: keine Tabelle, nur Inputs sichtbar
- API-Client `createTrip` / `updateTrip` Body-Type um `days` erweitert
- Locales: ~6 neue Keys für die Tabellen-Header (DE+EN)
- Version 0.10.0
- Production-Deploy via `gh workflow run deploy.yml`

### Out of Scope

- Live-Preview der berechneten Verpflegungspauschale pro Tag (kommt aus Summary nach Save).
- Bulk-Apply („alle Mittag stellen"-Button) — kann später ergänzt werden, jetzt nicht nötig für Single-Day-Markierung.
- Trip-Day-Edit aus der Reisen-Liste heraus (bleibt Übersicht-Tab).

## 3. Architekturentscheidungen

### 3.1 `classifyTripPreview` als UI-Helper, kein Backend-Endpoint

Die Logik ist deterministisch, klein (10 Zeilen TS) und schon Backend-seitig voll getestet. Ein Backend-Preview-Endpoint (`POST /api/trips/preview`) wäre saubere Architektur aber unnötig — die Frontend-Reimplementierung ist trivial und vermeidet Round-Trip bei jedem Datum-Tastenanschlag.

**Konvention-Bruch akzeptiert:** Eine 10-Zeilen-Tagestyp-Berechnung im Frontend duplicates Backend-Logik. Das ist ein klar abgegrenztes Stück mit hoher Stabilität (Steuersätze ändern sich, Tag-Klassifikation nicht). Wenn die Regeln sich ändern, sind beide Stellen zu pflegen — dokumentiert als Code-Kommentar in beiden Files.

### 3.2 dayOverrides als optionales Argument, kein Pflichtfeld

`create(db, input, dayOverrides?)`. Default = `[]` = bisheriges Verhalten. Existing curl-clients, Phase-2.B Übersicht-Day-CRUD, Integration-Tests laufen unverändert.

### 3.3 Backend ignoriert non-matching Daten

Wenn der Client einen day-Override für ein Datum schickt, das nicht in der `classifyTrip`-Ausgabe vorkommt: silently ignored. Kein 400-Error. Das vereinfacht Frontend-Logic (bei Datums-Änderung der user-getippten Day-Werte bleiben in der state).

### 3.4 Homeoffice-Combo-Flag nur bei anreise/abreise

Backend prüft NICHT, ob `homeoffice: true` auf einem `reise_voll`-Tag gesetzt ist — das ist Frontend-Verantwortung (Checkbox wird nur bei anreise/abreise gerendert). Plausibilitäts-Check `DOPPEL_HO_REISE_VOLL` aus 2.B fängt es notfalls.

### 3.5 Edit-Modus pre-fillt existing-Werte

Beim Open des Edit-Dialogs werden die `editTrip.days` durchgegangen und matched mit den `classifyTripPreview`-Ausgaben pro Datum. Existierende Mahlzeiten/Zuzahlung/HO-Flag werden in die Tabellen-State übernommen. So sieht User „seine" Werte und der Hart-Reset wirft sie nicht stillschweigend weg.

### 3.6 Versionsbump 0.10.0

Neue API-Surface (optionales Feld) + neue UX-Funktion. Minor.

## 4. Schnittstellen-Änderungen

### 4.1 Backend Service

```ts
interface DayOverride {
  date: string;
  fruehstueck?: boolean;
  mittag?: boolean;
  abend?: boolean;
  zuzahlungCent?: number;
  homeoffice?: boolean;
}

create(db, input: TripInput, dayOverrides?: DayOverride[]): TripWithDays
update(db, id: number, input: TripInput, dayOverrides?: DayOverride[]): TripWithDays | null
```

### 4.2 Backend Route Body

```ts
const TripBody = z.object({
  startDate, endDate, uebernachtung,
  days: z.array(z.object({
    date: DateSchema,
    fruehstueck: z.boolean().optional(),
    mittag: z.boolean().optional(),
    abend: z.boolean().optional(),
    zuzahlungCent: z.number().int().nonnegative().optional(),
    homeoffice: z.boolean().optional(),
  })).optional().default([]),
});
```

### 4.3 UI

```ts
// ui/src/lib/trip-preview.ts
export interface PreviewDay { date: string; type: DayType; }
export function classifyTripPreview(
  startDate: string, endDate: string, uebernachtung: boolean
): PreviewDay[] | null;  // null bei invalid input
```

```ts
// API-Client
api.createTrip(body: TripBody & { days?: DayOverride[] }): Promise<TripWithDays>
api.updateTrip(id, body): Promise<TripWithDays>
```

## 5. Test-Strategie

- Service-Unit: 3 Tests (mit Override, ohne Override = default, non-matching date ignored). Backward-compat existing tests bleiben grün.
- Integration: 2 Tests (POST mit days-Array, PUT mit days-Array).
- UI: kein Unit-Test (Pattern aus 2.B/2.C). Manueller Browser-Smoke nach Deploy.

Erwartet: 173 → ~178 Backend-Tests.

## 6. Abschluss-Kriterien

- [ ] `pnpm test` ~178 grün
- [ ] `pnpm typecheck` + `pnpm typecheck:ui` + lint grün
- [ ] Browser-Smoke: Reise anlegen mit Mahlzeiten → in Übersicht-Kalender sind die Tage korrekt markiert + Summary zeigt Kürzungs-Summe
- [ ] CHANGELOG `[0.10.0]`
- [ ] `gh workflow run deploy.yml` → Production läuft mit der neuen Version
