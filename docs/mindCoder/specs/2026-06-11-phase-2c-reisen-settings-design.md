# Phase 2.C — Reisen-Seite + Settings + `/api/settings`

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Phase 2.B](2026-06-11-phase-2b-uebersicht-design.md), [Phase 1.A](2026-06-11-phase-1a-fundament-auth-design.md) (DB-Schema), [Implementierungsdokument §5+§8](../../../../Reisekontor_Implementierungsdokument.docx), [Anforderungsdokument §5.5+§5.10](../../../../Reisekontor_Anforderungsdokument.docx)
**Status:** Implementierungsbereit

## 1. Zweck

Phase 2.C schließt die UI-Bedien-Schicht ab: die Reisen-Seite (CRUD per Liste + Dialog + Detail) und die Einstellungen-Seite (Standardwoche + Bundesland-Wechsel, Pauschalen-Read-Only). Neuer Backend-Endpoint `/api/settings` persistiert User-Overrides der Config in der `settings`-Tabelle (existiert seit 1.A). Bundesland-Wechsel triggert clientseitig `syncHolidays`.

## 2. Scope

### Im Scope

**Backend:**
- `src/services/settings.ts` mit `getEffectiveSettings(db, config)` und `updateSettings(db, body)`
- `src/server/routes/settings.ts` mit `GET /api/settings` und `PUT /api/settings`
- Service-Unit-Tests + Integration-Test
- `createServer.ts` registriert neue Route unter Auth
- Backend-Error-Codes: `invalid_bundesland_in_settings`, `invalid_standardwoche`

**UI — Reisen:**
- API-Client erweitert um `listTrips`, `getTrip`, `createTrip`, `updateTrip`, `deleteTrip`
- Hooks `useTrips`, `useCreateTrip`, `useUpdateTrip`, `useDeleteTrip` (Optimistic Updates)
- `ui/src/components/reisen/{ReisenList,ReiseFormDialog,ReiseDetail,ReiseDeleteDialog,HartResetWarnung}.tsx`
- `ui/src/pages/Reisen.tsx` als echte Seite

**UI — Einstellungen:**
- API-Client erweitert um `getSettings`, `updateSettings`
- Hooks `useSettings`, `useUpdateSettings`
- `ui/src/components/einstellungen/{SettingsForm,PauschalenAnzeige,BundeslandSelect,StandardwocheCheckboxes}.tsx`
- `ui/src/pages/Einstellungen.tsx` als echte Seite
- Auto-Holidays-Sync nach Bundesland-Wechsel (clientseitig)

**i18n:** Locales DE+EN erweitert um alle neuen Strings (~50 Keys)

**Release 0.7.0**

### Out of Scope

- Export-Funktionalität (Phase 3)
- Docker, CI/CD, Deploy (Phase 4)
- Per-Reise-Detail-Erweiterungen wie Kosten-Tracking (Anforderungsdok §2.2 Out-of-Scope)
- Dreimonatsfrist-Tracking (Anforderungsdok §4.3 — nicht implementierbar ohne Orts-Erfassung)
- Standardwochen-Auto-Generierung von Day-Entries (UI macht es nicht, Backend liefert nur explizite)

## 3. Architekturentscheidungen

### 3.1 Settings als Key-Value in der `settings`-Tabelle

Phase-1.A-Schema hat schon `settings(key text PRIMARY KEY, value text)`. Wir nutzen sie endlich:
- Key `standardwoche`: Value = JSON `{"mo":true,"di":true,...,"so":false}`
- Key `bundesland`: Value = `"NI"`

**Warum Key-Value statt strukturierter Tabelle:** zwei Felder rechtfertigen kein eigenes Schema. Das Pattern bleibt offen für künftige Settings (z. B. `language`, `default_year`).

### 3.2 Effective-Settings-Pattern

`getEffectiveSettings(db, config): EffectiveSettings` liest beide Keys aus DB. Fehlt ein Key, wird der Wert aus `config.raw` genommen. Result-Shape ist einheitlich:

```ts
interface EffectiveSettings {
  bundesland: string;          // 2-char DE-State-Code
  standardwoche: {
    mo, di, mi, do, fr, sa, so: boolean;
  };
}
```

UI muss nicht zwischen "Default" und "User-Override" unterscheiden — sie sieht immer den effektiven Wert.

### 3.3 `PUT /api/settings` validiert + persistiert

Body-Schema (Zod):
```ts
{
  bundesland?: string (length 2, in DE_STATES),
  standardwoche?: { mo,di,mi,do,fr,sa,so: boolean }
}
```

Beide Felder optional — partial updates erlaubt. `bundesland` wird gegen die `Holidays().getStates("DE")` Liste validiert (gleiches Pattern wie holidays-service). `standardwoche` muss alle 7 Boolean-Keys haben.

Response: das neue `EffectiveSettings`-Objekt nach dem Update.

### 3.4 Bundesland-Wechsel triggert NICHT auto-sync im Backend

Das ist explizit eine Client-Verantwortung. Vorteil: das `PUT /api/settings` bleibt klein und transaktional. UI ruft nach erfolgreichem PUT explizit `syncHolidays(year)` für das aktuelle Jahr.

### 3.5 Reisen-CRUD ist analog zu Days-CRUD aus 2.B

`useTrips(year)` returns `TripWithDays[]`. Mutations:
- `useCreateTrip` — kein Optimistic (Trip-ID ist erst nach Backend-Response bekannt; classifyTrip-Logik im Frontend wiederholen wäre fehleranfällig). Stattdessen: `onSuccess` invalidate.
- `useUpdateTrip` — kein Optimistic aus gleichem Grund.
- `useDeleteTrip` — Optimistic Remove (sicher, da nur eine Row entfernt wird).

Alle Mutationen invalidieren `["trips", year]`, `["days", year]`, `["summary", year]`, `["checks", year]`.

### 3.6 Trip-Form: HTML5 date inputs, kein shadcn calendar

`<Input type="date">` ist nativ, deutsch-lokalisiert via `<html lang="de">`, kostenlos. Calendar-Komponente wäre overkill für zwei Datums-Felder.

### 3.7 Hart-Reset-Warnung beim Trip-Update

Beim `Save` im Edit-Modus prüft die UI, ob existierende Day-Entries der Reise gepflegte Mahlzeiten ODER Zuzahlung haben (`fruehstueck || mittag || abend || zuzahlungCent > 0`). Wenn ja: AlertDialog "Diese Änderung setzt {N} gepflegte Mahlzeit-Markierungen zurück. Fortfahren?"

Bei `No` → kein Save. Bei `Yes` → PUT-Call wie immer.

### 3.8 Trip-Detail nutzt das existing `TagesdetailSheet`

Wenn der User in der Reisen-Liste auf einen Tag der Reise klickt, öffnet sich `TagesdetailSheet` mit `existing` aus dem aktuellen Trip. Das Sheet kennt das Trip-Day-Lock-Pattern bereits (Phase 2.B §3.6).

Sprich: keine separate `ReiseDetail`-Komponente nötig. Die Reisen-Liste rendert Trips mit ihren Day-Entries inline; ein Klick auf einen Day öffnet `TagesdetailSheet`.

### 3.9 Settings-Auto-Sync: 2 Schritte, ein Toast

UI-Flow bei Bundesland-Wechsel:
1. `useUpdateSettings.mutateAsync({bundesland: "BY"})` → 200
2. `useSyncHolidaysMutation.mutateAsync(year)` → 200 (skipped count zeigt User-Overrides)
3. Toast: "Einstellungen gespeichert. {created} Feiertage aktualisiert."

Wenn Schritt 2 fehlschlägt: Toast-Warning "Einstellungen gespeichert, aber Feiertags-Sync fehlgeschlagen — bitte manuell anstoßen". (Manuelle Sync-Trigger-Button gehört zur Settings-Seite.)

### 3.10 Pauschalen-Anzeige als Read-Only

Zeigt für das aktive Steuerjahr die Werte aus `config.raw.jahre[year]`. Pauschalen-Edit kommt nicht in 2.C — Sätze ändern sich gesetzlich, nicht user-präferiert. Edit würde Code-Change verlangen (`config/app.yaml` editieren, Redeploy).

### 3.11 Versionsbump 0.7.0

Neuer User-facing Workflow + neuer Backend-Endpoint → Minor.

## 4. Schnittstellen-Design

### 4.1 Backend Settings Service

```ts
export interface EffectiveSettings {
  bundesland: string;
  standardwoche: { mo: boolean; di: boolean; mi: boolean; do: boolean; fr: boolean; sa: boolean; so: boolean };
}

export function getEffectiveSettings(db: Db, config: AppConfig): EffectiveSettings;
export function updateSettings(
  db: Db,
  body: { bundesland?: string; standardwoche?: EffectiveSettings["standardwoche"] },
): EffectiveSettings;
```

Persistenz via `settings`-Tabelle, JSON-Encoded für standardwoche.

### 4.2 Backend Routes

```
GET /api/settings  → 200 EffectiveSettings
PUT /api/settings  → 200 EffectiveSettings (after update)
                     400 invalid_bundesland_in_settings
                     400 invalid_standardwoche
```

### 4.3 UI API-Client

```ts
api.listTrips(year): Promise<TripWithDays[]>;
api.getTrip(id): Promise<TripWithDays>;
api.createTrip(body): Promise<TripWithDays>;
api.updateTrip(id, body): Promise<TripWithDays>;
api.deleteTrip(id): Promise<{ok: true}>;
api.getSettings(): Promise<EffectiveSettings>;
api.updateSettings(body): Promise<EffectiveSettings>;
```

### 4.4 UI Hooks

```ts
useTrips(year): {data, isLoading}
useCreateTrip(year): mutation
useUpdateTrip(year): mutation
useDeleteTrip(year): mutation  // Optimistic remove
useSettings(): {data, isLoading}
useUpdateSettings(): mutation
```

### 4.5 Komponenten

```
ui/src/components/reisen/
├── ReisenList.tsx          # Card mit Tabelle aller Trips + actions
├── ReiseFormDialog.tsx     # Dialog Create/Edit mit Form
├── HartResetWarnung.tsx    # AlertDialog wenn manuelle Mahlzeiten verloren gehen
└── ReiseDeleteDialog.tsx   # Confirmation-Dialog

ui/src/components/einstellungen/
├── SettingsForm.tsx        # Bundesland + Standardwoche editierbar
├── BundeslandSelect.tsx    # Dropdown mit 16 DE-States
├── StandardwocheCheckboxes.tsx  # 7 Checkboxes
└── PauschalenAnzeige.tsx   # Read-only Display der 2026er Sätze
```

Plus shadcn `alert-dialog` (für Confirmations) und `table` (für ReisenList).

### 4.6 Backend-Bundesland-Liste

`DE_STATES = ["BB", "BE", "BW", "BY", "HB", "HE", "HH", "MV", "NI", "NW", "RP", "SH", "SL", "SN", "ST", "TH"]` — Single source of truth im Backend-Service. UI-Liste mit Anzeige-Namen kommt aus Locales:
- `bundeslaender.BB`: "Brandenburg"
- etc.

## 5. Tests

### 5.1 Backend Service-Tests

`src/services/settings.test.ts`:
- `getEffectiveSettings` ohne DB-Override → Config-Werte
- `getEffectiveSettings` mit DB-Override → DB-Werte
- `updateSettings` mit `{bundesland: "BY"}` → DB-Row geschrieben + Response aktualisiert
- `updateSettings` mit `{bundesland: "XX"}` → wirft
- `updateSettings` mit `{standardwoche: {...}}` → DB-Row geschrieben
- Partial update (nur ein Feld) → andere Felder bleiben

### 5.2 Backend Integration-Tests

`tests/api-settings.integration.test.ts`:
- GET ohne DB-Override → 200, Config-Werte
- PUT bundesland → 200, GET zeigt neuen Wert
- PUT invalid bundesland → 400
- PUT standardwoche → 200, GET zeigt neuen Wert

### 5.3 UI

Keine neuen UI-Tests in 2.C. Begründung: Komponenten folgen den 2.B-Mustern, manueller Smoke deckt die Flows ab. Component-Tests kommen mit Phase 3 wenn Export-Logik echte Berechnung im UI hat.

Erwartete Test-Anzahl: 136 (Backend) + ~10 neue Backend-Tests = ~146.

## 6. Abschluss-Kriterien

- [ ] `pnpm dev` + `pnpm dev:ui` → Browser:
  - Reisen-Seite: Liste mit existing Trips, Erstellen-Dialog → POST → Liste updates, Edit mit Hart-Reset-Warnung, Delete mit Confirmation
  - Einstellungen-Seite: Bundesland-Wechsel → auto-Holidays-Sync, Standardwoche-Edit, Pauschalen-Anzeige
  - Übersicht-Seite (aus 2.B) sieht Feiertag-Updates nach Settings-Wechsel
- [ ] `pnpm test` → ~146 Tests grün (136 + 10 Backend-Settings)
- [ ] `pnpm typecheck`, `pnpm typecheck:ui`, `pnpm lint:check`, `pnpm lint:ui` grün
- [ ] CHANGELOG `[0.7.0]`

## 7. Nächste Phase

Phase 3: Export-Funktionalität (PDF/Excel/CSV) für Reisekosten + Homeoffice-Nachweis. Backend-Routes `GET /api/export/reisekosten?year=&format=` und `GET /api/export/homeoffice?year=&format=`. Frontend-Page Export.
