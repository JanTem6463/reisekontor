# Phase 2.B — Übersicht-Seite (Kalender + Kennzahlen + Heatmap)

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Phase 2.A](2026-06-11-phase-2a-ui-skelett-design.md), [Implementierungsdokument](../../../../Reisekontor_Implementierungsdokument.docx), [Anforderungsdokument §5.8 + §8](../../../../Reisekontor_Anforderungsdokument.docx)
**Status:** Implementierungsbereit

## 1. Zweck dieser Phase

Phase 2.B liefert die Kern-Bedien-Schicht: die Übersicht-Seite als Mittelpunkt des Workflows. Der User sieht Kennzahlen für sein Steuerjahr, klickt im Monatskalender auf Tage zum Setzen von Tagestyp + Mahlzeiten, sieht Plausibilitäts-Hinweise und eine Jahres-Heatmap. Nach 2.B kann der User vollständig seine Daten via UI pflegen — die Reisen-Seite (2.C) baut auf den gleichen Patterns auf.

## 2. Scope

### Im Scope von Phase 2.B

- TanStack Query (`@tanstack/react-query`) als Server-State-Management
- date-fns für Datums-Math + de-Locale für Wochentage/Monatsnamen
- shadcn-Komponenten ergänzt: `dialog`, `sheet`, `badge`, `separator`, `skeleton`, `checkbox`, `select`, `progress`, `scroll-area`
- API-Client um Endpoints `listDays`, `upsertDay`, `deleteDay`, `getSummary`, `getChecks`, `syncHolidays` erweitert
- `YearContext` + `useYear()` Hook mit Persistenz in `localStorage['rk-year']`
- Komponenten:
  - `YearSelector` (Top der Übersicht-Seite)
  - `KennzahlenCards` (6 Kennzahlen)
  - `PlausibilitaetList` (Hinweise mit i18n)
  - `Monatskalender` (eigene Komponente mit Tagestyp-Farben)
  - `TagesdetailSheet` (Sheet von rechts, Form für Tagestyp + Mahlzeiten)
  - `YearHeatmap` (CSS-Grid 12×31, Tagestyp-Farben)
- `Uebersicht.tsx` als echte Seite (statt Placeholder)
- Locales erweitert um alle neuen Strings
- Sonner-Theme-Fix aus 2.A nachgezogen (Theme aus `rk-theme` ableiten)
- CHANGELOG `[0.6.0]`

### Out of Scope

- Reisen-Liste / Reisen-Detail (Phase 2.C)
- Settings-Form mit Standardwoche/Bundesland-Override (Phase 2.C + Backend `/api/settings`)
- Export-Dialog (Phase 3)
- TopBar-Bundeslandwechsel-Trigger für Feiertags-Sync (Phase 2.C)
- Automatische Standardwochen-Generierung (UI macht es bewusst NICHT — Backend bleibt single source of truth)
- Frontend-Berechnung der Pauschalen — Backend liefert sie via `/api/summary` (UI zeigt erst nach Save)
- UI-Tests (kommen mit Phase 2.C, wenn Komplexität echte Tests rechtfertigt)

## 3. Architekturentscheidungen

### 3.1 TanStack Query statt React Context für Server-State

`useQuery` für `listDays`, `getSummary`, `getChecks`. `useMutation` mit Optimistic Updates für `upsertDay`/`deleteDay`. Query-Keys: `["days", year]`, `["summary", year]`, `["checks", year]`.

`staleTime: 30_000`, `refetchOnWindowFocus: true`. Bei 401 → `UnauthorizedError` propagiert, ein globaler Error-Handler navigiert auf `/login`.

**Warum:** Cache + Background-Refetch + Optimistic Updates sind genau das, was eine CRUD-UI braucht. Selber zu schreiben wäre Reinvent-The-Wheel.

### 3.2 date-fns statt dayjs

Tree-shakeable, hat de-Locale, modernes API. `format`, `addMonths`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `isSameMonth`. Locale-Import: `import { de } from "date-fns/locale"`.

### 3.3 YearContext mit Hook + localStorage-Persistenz

```ts
const YearContext = createContext<{year: number, setYear: (y: number) => void}>(...);
export function useYear() { return useContext(YearContext); }
```

Default = aktuelles Kalenderjahr (`new Date().getFullYear()` — in `App.tsx` einmal beim Mount, ok da kein Domain-Code). Persist in `localStorage['rk-year']`.

YearSelector rendert ein Dropdown mit verfügbaren Jahren — alle Jahre, die `config.raw.jahre` kennt (initial 2026). Da wir den Backend-Config-Endpoint noch nicht haben, hardcode `[2024, 2025, 2026]` im Frontend; in 2.C ergänzen wir einen Config-Endpoint, der die verfügbaren Jahre liefert.

### 3.4 Tagestyp-Farben als semantische Tailwind-Klassen

Pro `DayType` eine Hintergrund-Klasse mit guter Dark/Light-Lesbarkeit:

| DayType | Farbe (Tailwind) | Bedeutung |
|---|---|---|
| `homeoffice` | `bg-blue-500/20 text-blue-500 border-blue-500/40` | Standard-Arbeitstag |
| `buero` | `bg-cyan-500/20 text-cyan-500 border-cyan-500/40` | Erste Tätigkeitsstätte |
| `reise_anreise` | `bg-orange-500/30 text-orange-500 border-orange-500/50` | Anreise |
| `reise_voll` | `bg-red-500/30 text-red-500 border-red-500/50` | Voller Reisetag |
| `reise_abreise` | `bg-orange-500/30 text-orange-500 border-orange-500/50` | Abreise |
| `reise_eintaegig` | `bg-amber-500/30 text-amber-500 border-amber-500/50` | Eintägige Reise |
| `urlaub` | `bg-green-500/20 text-green-500 border-green-500/40` | Urlaub |
| `krankheit` | `bg-zinc-500/20 text-zinc-500 border-zinc-500/40` | Krankheit |
| `feiertag` | `bg-purple-500/20 text-purple-500 border-purple-500/40` | Gesetzlicher Feiertag |
| (kein Eintrag) | `border-border bg-transparent text-muted-foreground` | Standard/Wochenende |

Helper-Funktion `dayTypeClasses(type)` in `ui/src/lib/day-styles.ts`. Mit `cn()` kombinierbar.

Kombi-Tag (Anreise/Abreise + `homeoffice=true`): Hintergrund = Reise-Farbe, zusätzlich ein Badge oder Icon (z. B. ein kleiner Haus-Indikator in der Ecke).

### 3.5 Monatskalender als eigene Komponente, NICHT shadcn `calendar`

shadcn calendar (basiert auf react-day-picker) ist auf Date-Picking ausgelegt, nicht auf Daten-Visualisierung pro Tag. Wir bauen eine schmale eigene Komponente:

- Props: `year`, `month`, `days: DayEntry[]`, `onDayClick(date)`, `selectedDate?: string`
- Header: `<Monatsname> <Jahr>` plus Prev/Next-Buttons
- 7-Spalten-Grid (Wochenbeginn Montag, deutsch)
- Pro Tag ein `<button>` mit:
  - Datum oben
  - Hintergrund = Tagestyp-Farbe (oder neutral, wenn kein Eintrag)
  - Kombi-Badge rechts unten, wenn `homeoffice=true` auf Reise-Tag
  - Outline wenn `selectedDate === iso`
  - Hover-Effekt
- Datum-Cells außerhalb des aktuellen Monats: gedimmt aber klickbar

### 3.6 TagesdetailSheet — `sheet` von rechts

shadcn `Sheet` mit `side="right"`. Inhalt:

- Header: Datum deutsch formatiert (`format(date, "EEEE, d. MMMM yyyy", {locale: de})`) → „Mittwoch, 15. März 2026"
- Tagestyp-Select (alle 9 DayTypes + Option „Kein Eintrag" = entspricht DELETE)
- Wenn aktuell ein Trip-Tag angezeigt wird (`existing.tripId !== null`): Typ-Select disabled mit Hinweis „Reisetag — Bearbeitung nur über Reisen-Seite"
- Wenn `type ∈ {reise_anreise, reise_abreise}`: zusätzlich Checkbox „Homeoffice an diesem Tag" (Kombi-Tag)
- Wenn `type ∈ {reise_*}`: Mahlzeiten-Checkboxes (Frühstück, Mittag, Abend) + Zuzahlung-Input (€)
- Buttons:
  - „Speichern" (PUT)
  - „Löschen" (DELETE — disabled bei Reisetagen mit Tooltip „Reise-Tag — über Reisen-Seite löschen")
  - „Abbrechen" (Sheet schließen)
- Toast bei Erfolg: „Tag gespeichert" / „Tag gelöscht"
- Toast bei Fehler: i18n-übersetzter Backend-Error-Code

### 3.7 Optimistic Updates für upsertDay

```ts
useMutation({
  mutationFn: api.upsertDay,
  onMutate: async (newDay) => {
    await queryClient.cancelQueries({queryKey: ["days", year]});
    const previous = queryClient.getQueryData(["days", year]);
    queryClient.setQueryData(["days", year], (old) => updateInPlace(old, newDay));
    return {previous};
  },
  onError: (err, _new, context) => {
    queryClient.setQueryData(["days", year], context?.previous);
    toast.error(t(`errors.${err.code}`));
  },
  onSettled: () => {
    queryClient.invalidateQueries({queryKey: ["days", year]});
    queryClient.invalidateQueries({queryKey: ["summary", year]});
    queryClient.invalidateQueries({queryKey: ["checks", year]});
  },
})
```

Selbe Pattern für `deleteDay`.

### 3.8 KennzahlenCards — 6 Cards in einem Grid

1. **Verpflegungspauschale** — `summary.verpflegungSummeCent` formatiert als €
2. **Kürzungs-Summe** — `summary.kuerzungSummeCent` (informativ, gleicher €-Format)
3. **Homeoffice-Tage** — `summary.homeofficeTage / summary.homeofficeMaxTage` mit `Progress`-Bar
4. **Homeoffice-Pauschale** — `summary.homeofficeBetragCent / summary.homeofficeMaxBetragCent`
5. **Reisen** — `summary.reisenAnzahl` (Anzahl)
6. **Reisetage gesamt** — Summe über `reisetageNachTyp`

`Card` mit Header (Titel + ggf. Icon aus lucide-react) und Content (Wert groß, Subtitel klein/muted).

### 3.9 PlausibilitaetList — Hinweise mit Schweregrad-Farben

- Liste der `{code, date, schwere}` aus `/api/checks`
- Sortiert: warnung zuerst, dann hinweis, dann nach Datum
- Pro Hinweis: Badge mit Schweregrad-Farbe + Datum + i18n-übersetzter Text
- i18n-Keys: `checks.codes.DOPPEL_HO_REISE_VOLL` etc.
- Leere Liste: „Keine offenen Hinweise."

### 3.10 YearHeatmap — CSS-Grid statt Recharts

Recharts ist für Linien-/Balken-Charts gedacht. Eine Heatmap dieser Form ist mit Recharts möglich, aber sperrig. Eigene Komponente mit CSS-Grid ist schlanker, kontrollierbar, identische Farbpalette wie der Monatskalender.

Layout: 12 Zeilen (Monate Jan–Dez) × 31 Spalten (Tage 1–31). Inkorrekte Tage (z. B. 30. Februar) bleiben leer. Zelle = klickbarer kleiner Button mit Tagestyp-Hintergrund. Klick → Monatskalender springt zu diesem Monat + öffnet Tagesdetail.

Recharts kommt in späteren Phasen, wenn Trend-Charts (Verpflegung pro Monat etc.) gebraucht werden.

### 3.11 Sonner-Theme-Fix

Aktuell `theme="system"` — bei Light-OS / Dark-App falsch. Fix: einen Hook `useResolvedTheme()`, der `document.documentElement.classList.contains("dark")` beobachtet (via MutationObserver) und `theme={"dark" | "light"}` setzt.

### 3.12 Versionsbump 0.6.0

Substantielle neue Funktionalität (Kalender + CRUD per UI + Kennzahlen + Heatmap). Minor-Bump.

## 4. Schnittstellen-Erweiterungen

### 4.1 API-Client (`ui/src/lib/api.ts`) — neue Funktionen

```ts
export interface DayEntryDto {
  date: string;
  year: number;
  type: DayType;
  homeoffice: boolean;
  tripId: number | null;
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungCent: number;
}

export interface YearSummary { /* aus Backend-Spec §4.4 */ }

export interface PlausibilitaetHinweis {
  code: "DOPPEL_HO_REISE_VOLL" | "EINTAEGIG_8H_BESTAETIGEN" | "HO_KONFLIKT_ENTFERNUNG";
  date: string;
  schwere: "hinweis" | "warnung";
}

api.listDays(year): Promise<DayEntryDto[]>;
api.upsertDay(date: string, body: {type, homeoffice?, tripId?, meals?, zuzahlungCent?}): Promise<{ok: true, created: boolean}>;
api.deleteDay(date: string): Promise<{ok: true}>;
api.getSummary(year): Promise<YearSummary>;
api.getChecks(year): Promise<PlausibilitaetHinweis[]>;
api.syncHolidays(year): Promise<{year, bundesland, created, skipped}>;
```

### 4.2 Komponenten-Map

```
ui/src/
├── components/
│   ├── uebersicht/
│   │   ├── YearSelector.tsx
│   │   ├── KennzahlenCards.tsx
│   │   ├── PlausibilitaetList.tsx
│   │   ├── Monatskalender.tsx
│   │   ├── TagesdetailSheet.tsx
│   │   └── YearHeatmap.tsx
│   └── ui/                  # shadcn ergänzt um dialog, sheet, badge, separator,
│                            #   skeleton, checkbox, select, progress, scroll-area
├── contexts/
│   └── YearContext.tsx
├── hooks/
│   ├── useDays.ts           # useQuery wrapper
│   ├── useSummary.ts
│   ├── useChecks.ts
│   ├── useUpsertDay.ts      # useMutation mit Optimistic
│   ├── useDeleteDay.ts
│   └── useResolvedTheme.ts  # für Sonner-Fix
├── lib/
│   ├── day-styles.ts        # dayTypeClasses(), labels, sortOrder
│   ├── money-format.ts      # formatEur(cent) für UI
│   └── query-client.ts      # QueryClient + provider helper
└── pages/
    └── Uebersicht.tsx       # neu, statt Placeholder
```

## 5. Locales-Erweiterungen

Neue i18n-Keys (DE + EN parallel):

```
day_types.homeoffice / buero / reise_anreise / reise_voll / reise_abreise /
  reise_eintaegig / urlaub / krankheit / feiertag
meals.fruehstueck / mittag / abend
checks.codes.DOPPEL_HO_REISE_VOLL / EINTAEGIG_8H_BESTAETIGEN / HO_KONFLIKT_ENTFERNUNG
checks.empty
kennzahlen.verpflegung / kuerzung / homeoffice_tage / homeoffice_betrag /
  reisen_anzahl / reisetage_gesamt
kennzahlen.{key}.label / {key}.subtitle
tagesdetail.title / tagesdetail.type_label / tagesdetail.no_entry /
  tagesdetail.meals_label / tagesdetail.zuzahlung_label / tagesdetail.homeoffice_combo_label /
  tagesdetail.save / tagesdetail.delete / tagesdetail.cancel /
  tagesdetail.trip_locked_hint
kalender.prev_month / kalender.next_month / kalender.weekday.short.mo/di/mi/do/fr/sa/so
heatmap.title
year_selector.label
errors.invalid_query / errors.year_not_configured / errors.reise_type_via_trips /
  errors.type_locked_for_trip_day / errors.trip_id_locked / errors.reise_day_via_trip /
  errors.date_conflict / errors.internal_error
```

## 6. Abschluss-Kriterien

- [ ] `pnpm dev` + `pnpm dev:ui` → Browser: Login → Übersicht zeigt:
  - YearSelector → Wert wechseln aktualisiert alles
  - 6 Kennzahlen-Karten mit korrekten Werten
  - Plausi-Hinweise-Liste (oder „leer")
  - Monatskalender mit prev/next-Navigation
  - Klick auf Tag → TagesdetailSheet rechts → Typ ändern → Speichern → Kalender + Kennzahlen updaten optimistisch
  - YearHeatmap unten zeigt 12×31 Grid mit Farben
- [ ] `pnpm test` → 136 Backend-Tests grün
- [ ] `pnpm typecheck` + `pnpm typecheck:ui` grün
- [ ] `pnpm lint:check` + `pnpm lint:ui` grün
- [ ] CHANGELOG `[0.6.0] — 2026-06-11`

## 7. Nächste Phase

Phase 2.C: Reisen-Liste mit Erstellen/Editieren/Löschen, Einstellungen-Seite (Standardwoche + Bundesland-Wechsel mit auto-Sync), `/api/settings` Backend-Route.
