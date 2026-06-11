# Phase 0 — Skelett + Berechnungs-Engine

**Datum:** 2026-06-11
**Projekt:** Reisekontor — persönliche Reisekosten- & Homeoffice-Erfassung
**Grundlage:** [Anforderungsdokument v1.0](../../../../Reisekontor_Anforderungsdokument.docx), [Implementierungsdokument v1.0](../../../../Reisekontor_Implementierungsdokument.docx), mindsquare Agent Template v2.1
**Status:** Implementierungsbereit

## 1. Zweck dieser Phase

Phase 0 liefert das Projekt-Skelett und die voll getestete Berechnungs-Engine. Es entstehen **keine** Datenbank, **kein** HTTP-Server und **keine** UI — die folgen in späteren Phasen. Am Ende von Phase 0 sind alle Pflicht-Testfälle aus §14.1 des Impl-Dokuments grün und das Projekt lässt sich linten, testen und typprüfen.

Begründung der Phasentrennung: Die Berechnungs-Engine ist laut Impl-Dok §7.1 die kritische Komponente („wichtigste Qualitätszusage des Projekts: keine Rechenfehler"). Sie wird testgetrieben in Isolation entwickelt, bevor I/O-Schichten dazukommen. So bleibt sie 100 % rein und unabhängig prüfbar.

## 2. Scope

### Im Scope von Phase 0

- pnpm-Workspace (Server-Workspace + Platzhalter für UI-Workspace ab Phase 2)
- TypeScript strict (`tsc --noEmit` läuft sauber)
- Tooling: Biome, Vitest
- `CLAUDE.md`, `README.md`, `CHANGELOG.md` (Keep-a-Changelog), `.gitignore`, `.env.example`
- `config/app.yaml` mit Sätzen 2026, Standardwoche, Bundesland NI — **ohne** Loader-Code (kommt in Phase 1)
- `src/shared/money.ts` — Cent-Formatierungs-Helpers
- `src/domain/` — Berechnungs-Engine als reine Funktionen
  - `types.ts` — `DayType`, `Meals`, `DayEntry`, `Rates`
  - `pauschalen.ts` — Kürzung, Verpflegung pro Tag, Homeoffice-Tage, Homeoffice-Pauschale (mit 1.260 €-Deckel)
  - `trip-classify.ts` — Ableitung An-/Abreise / voll / eintägig aus Reisezeitraum
  - `plausibilitaet.ts` — Doppelerfassung, 8-h-Hinweis, Entfernungspauschalen-Konflikt
- Vitest-Tests neben jeder Quelldatei (`*.test.ts`)
- Alle Pflicht-Testfälle aus Impl-Dok §14.1 als eigene `it()`-Blöcke
- `specs/` mit Mermaid-Diagrammen: `domain/entities.mmd`, `workflows/tagestyp.mmd`, `README.md`
- `docs/architecture.md` — Architekturentscheidungen aus §2.3 + Mitternachts-Vereinfachung (siehe §4.3 unten)
- Erste Git-Commits auf `main`

### Out of Scope für Phase 0 (kommt später)

| Bestandteil | Phase |
|---|---|
| `src/db/` Drizzle-Schema + Migrationen | Phase 1 |
| `src/server/` Hono-API + Auth-Middleware | Phase 1 |
| `src/config/` Zod-validierter YAML-Loader | Phase 1 |
| Feiertagslogik (`date-holidays`) + Sync-Endpoint | Phase 1 |
| `ui/` Vite + React + shadcn/ui | Phase 2 |
| i18n (DE/EN, react-i18next) | Phase 2 |
| `src/export/` PDF / Excel / CSV | Phase 3 |
| `docker/` Dockerfile + Compose | Phase 4 |
| Caddy-Eintrag, DNS, Backup-Cron | Phase 4 |
| GitHub Actions CI | Phase 4 |

Leere Platzhalter-Verzeichnisse werden **nicht** angelegt. Was Phase 0 nicht baut, existiert auch nicht im Repo. Halbfertige Implementierungen sind verboten.

## 3. Architekturentscheidungen (Phase 0)

### 3.1 Domain ist 100 % rein

Sätze (`Rates`) werden als Parameter übergeben, nicht aus der Config importiert. Tests injizieren ein Fixtures-Objekt mit den 2026er-Sätzen.

**Warum:** Die Engine ist ohne Setup testbar (`vitest src/domain`), und sie bleibt unabhängig davon, wie die Sätze später geladen werden (YAML, DB-Override, Tenant-Konfig — egal).

### 3.2 Beträge in Cent (Integer)

Verbindlich für die gesamte Berechnung. Tests schreiben Erwartungswerte als z. B. `1680` (= 16,80 €), nicht als `16.80`.

**Warum:** Float-Arithmetik produziert Rundungsfehler, die in einer Steueranwendung nicht akzeptabel sind. `Math.max(base - kuerz, 0)` bleibt mit Integern verlustfrei.

`src/shared/money.ts` enthält nur Helpers für **Ausgabe** (`formatEur(centValue: number): string`). Keine Math-Funktionen — die liegen in der Domain.

### 3.3 Mitternachtsregelung — bewusste Vereinfachung

Anforderungsdok §4.1 spezifiziert die Mitternachtsregelung mit „Tag mit überwiegender Abwesenheit". Das setzt Uhrzeiten voraus. Reisekontor erfasst aber bewusst keine Uhrzeiten (Anforderungsdok §1.3 Out-of-Scope, §1.1: maximale Reduktion des Pflegeaufwands).

**Vereinfachung:** Bei einer eintägigen Reise ohne Übernachtung über zwei Kalendertage bekommt der **erste** Tag `reise_eintaegig` (14 €), der zweite Tag erhält **keinen Reise-Eintrag** und fällt damit auf den Standardwochen-Default (i. d. R. `homeoffice` oder `feiertag`/`urlaub`/`krankheit`, falls explizit gesetzt) zurück.

**Warum erster Tag, nicht zweiter:** Bei Geschäftsreisen ist die überwiegende Aktivität typischerweise tagsüber am Anreisetag; die Nachtrückreise verschiebt nur den geografischen Aufenthalt, nicht den Geschäftszweck. Diese Vereinfachung wird in `docs/architecture.md` dokumentiert.

**Test:** `trip-classify` mit `start=2026-03-04, end=2026-03-05, uebernachtung=false` ergibt genau einen Eintrag `{date: "2026-03-04", type: "reise_eintaegig"}`.

### 3.4 Plausibilitätsprüfungen sind reine Lesefunktionen

`plausibilitaet.checkAll(days: DayEntry[]): PlausibilitaetHinweis[]` mutiert nichts, sondern liefert nur eine Hinweis-Liste. Codes (stabil, übersetzbar in der späteren UI):

- `DOPPEL_HO_REISE_VOLL` — `homeoffice=true` an einem `reise_voll`-Tag (Anf §FA-21)
- `EINTAEGIG_8H_BESTAETIGEN` — `reise_eintaegig` benötigt Bestätigung > 8 h (Anf §FA-22)
- `HO_KONFLIKT_ENTFERNUNG` — Hinweis auf Konflikt mit Entfernungspauschale (Anf §FA-24)

Schweregrade: `'hinweis'` (informativ) | `'warnung'` (Bestätigung nötig).

### 3.5 Biome statt ESLint + Prettier

Wie Impl-Dok §3 vorschreibt. Ein Tool, eine Config, schnellere CI.

## 4. Konzeptionelles Schnittstellen-Design

### 4.1 Typen (`src/domain/types.ts`)

```ts
export type DayType =
  | "homeoffice" | "buero"
  | "reise_anreise" | "reise_voll" | "reise_abreise" | "reise_eintaegig"
  | "urlaub" | "krankheit" | "feiertag";

export interface Meals { fruehstueck: boolean; mittag: boolean; abend: boolean; }

export interface DayEntry {
  date: string;        // ISO YYYY-MM-DD
  type: DayType;
  homeoffice: boolean; // Kombi-Flag: HO zusätzlich zum Tagestyp (nur bei Anreise/Abreise sinnvoll)
  meals: Meals;
  zuzahlungCent: number;
}

export interface Rates {
  kleineCent: number;             // 1400
  grosseCent: number;             // 2800
  kuerzFruehstueckCent: number;   // 560
  kuerzHauptCent: number;         // 1120 (Mittag und Abend identisch)
  homeofficeProTagCent: number;   // 600
  homeofficeMaxCent: number;      // 126000 (= 210 × 600)
}

export interface TripInput {
  startDate: string;       // ISO
  endDate: string;         // ISO
  uebernachtung: boolean;  // false → eintägig (auch über 2 Kalendertage)
}

export interface ClassifiedDay {
  date: string;
  type: DayType;
}
```

### 4.2 Berechnungs-Funktionen (`src/domain/pauschalen.ts`)

```ts
export function kuerzungCent(meals: Meals, rates: Rates): number;
export function verpflegungProTagCent(day: DayEntry, rates: Rates): number;
export function homeofficeTage(days: DayEntry[]): number;
export function homeofficePauschaleCent(days: DayEntry[], rates: Rates): number;
```

Implementierung folgt den Code-Beispielen aus Impl-Dok §7.3 wörtlich.

### 4.3 Reise-Klassifikation (`src/domain/trip-classify.ts`)

```ts
export function classifyTrip(input: TripInput): ClassifiedDay[];
```

Regeln:
- **1 Kalendertag, ohne Übernachtung** → `[{date, type: 'reise_eintaegig'}]`
- **1 Kalendertag, mit Übernachtung** → unzulässig; Funktion wirft `Error("Eintägige Reise kann keine Übernachtung haben")`
- **2 Kalendertage, ohne Übernachtung** → `[{date: start, type: 'reise_eintaegig'}]` (siehe §3.3)
- **2 Kalendertage, mit Übernachtung** → `[{start: reise_anreise}, {end: reise_abreise}]`
- **n ≥ 3 Kalendertage, mit Übernachtung** → `[reise_anreise, reise_voll × (n-2), reise_abreise]`
- **n Kalendertage, ohne Übernachtung, n > 2** → unzulässig; Funktion wirft `Error("Mehrtägige Reise ohne Übernachtung nicht möglich")`. Die UI muss diese und die obigen unzulässigen Fälle verhindern; die Domain ist das letzte Sicherheitsnetz.

### 4.4 Plausibilität (`src/domain/plausibilitaet.ts`)

```ts
export interface PlausibilitaetHinweis {
  code: 'DOPPEL_HO_REISE_VOLL' | 'EINTAEGIG_8H_BESTAETIGEN' | 'HO_KONFLIKT_ENTFERNUNG';
  date: string;
  schwere: 'hinweis' | 'warnung';
}

export function checkAll(days: DayEntry[]): PlausibilitaetHinweis[];
```

Die Texte selbst kommen später in der UI über i18n. Die Domain liefert nur die Codes — sie kennt keine deutschen/englischen Strings.

## 5. Test-Strategie

### 5.1 Pflicht-Testfälle aus Impl-Dok §14.1

Jeder dieser Fälle wird ein eigener `it()` in `pauschalen.test.ts`:

| Szenario | Erwartung (Cent) |
|---|---|
| Anreisetag ohne gestellte Mahlzeit | `1400` |
| Voller Tag, Abendessen gestellt | `1680` (= 2800 − 1120) |
| Voller Tag, Frühstück + Abendessen gestellt | `1120` (= 2800 − 1680) |
| Anreisetag, Mittag + Abend gestellt | `0` (`max(1400 − 2240, 0)`) |
| Eintägige Reise > 8 h, keine Mahlzeit | `1400` |
| Zuzahlung 3,00 € bei gestelltem Mittag (voller Tag) | `1980` (= 2800 − (1120 − 300)) |
| Jahr mit Urlaub/Krankheit/Feiertag | Diese Tage **nicht** im HO-Zähler |
| 215 HO-Tage | Pauschale gedeckelt auf `126000` |
| Kombi-Tag: Anreise + Homeoffice | Verpflegung `1400` UND als HO-Tag gezählt |

### 5.2 Ergänzende Engine-Tests

- Kürzungs-Floor: bei voller Tagessatz-übersteigender Kürzung bleibt das Ergebnis `0`, nie negativ.
- Zuzahlung > Kürzung: Zuzahlung wird nicht über die Kürzung hinaus angerechnet (kein „Bonus").
- HO-Zähler an 209/210/211 Tagen — Deckel greift erst ab 211.
- Leeres `DayEntry[]` → `0` Verpflegung, `0` HO-Pauschale, `0` HO-Tage.

### 5.3 `trip-classify` Tests

- 1-Tages-Reise ohne Übernachtung → eintägig
- 1-Tages-Reise mit Übernachtung → wirft `Error`
- 2-Tages-Reise ohne Übernachtung (Mitternachtsregelung) → eintägig auf Start-Datum
- 2-Tages-Reise mit Übernachtung → Anreise + Abreise
- 3-Tages-Reise mit Übernachtung (genau 1 voller Tag)
- 7-Tages-Reise mit Übernachtung (5 volle Tage)
- 3+-tägig ohne Übernachtung → wirft `Error`

### 5.4 `plausibilitaet` Tests

- Tag mit `type: 'reise_voll', homeoffice: true` → liefert `DOPPEL_HO_REISE_VOLL`
- Tag mit `type: 'reise_eintaegig'` → liefert `EINTAEGIG_8H_BESTAETIGEN`
- Tag mit `type: 'homeoffice'` → liefert `HO_KONFLIKT_ENTFERNUNG`
- Saubere `DayEntry[]` ohne Konflikte → leere Liste

## 6. Projekt-Tooling

### 6.1 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### 6.2 `package.json` Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:domain": "vitest run src/domain",
    "lint": "biome check --apply src",
    "typecheck": "tsc --noEmit"
  }
}
```

`pnpm dev`, `pnpm build`, `pnpm db:migrate` aus dem Impl-Dok-CLAUDE.md kommen erst in Phase 1 dazu. Die CLAUDE.md beschreibt dann den Soll-Zustand am Ende von Phase 1; in Phase 0 nutzt sie bereits das vollständige Vokabular, kennzeichnet aber, was noch nicht vorhanden ist.

### 6.3 `biome.json`

Defaults von Biome plus: `formatter.indentStyle: "space"`, `formatter.indentWidth: 2`, `linter.rules.suspicious.noExplicitAny: "error"` (entspricht der CLAUDE.md-Regel „NIEMALS `any`").

## 7. Abschluss-Kriterien Phase 0

- [ ] `pnpm install` läuft sauber durch
- [ ] `pnpm test` → grün, alle §14.1-Pflichtfälle abgedeckt
- [ ] `pnpm typecheck` → grün
- [ ] `pnpm lint` → grün
- [ ] `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `docs/architecture.md`, `specs/README.md` vorhanden und nicht-trivial
- [ ] Mermaid-Diagramme öffnen ohne Fehler in einem Markdown-Viewer
- [ ] Erster Commit auf `main`: `init: phase 0 — projekt-skelett + domain-engine`

## 8. Nächste Phase

Phase 1: `src/config/` (Zod-validierter YAML-Loader), `src/db/` (Drizzle-Schema + Migrationen + SQLite-Client), `src/server/` (Hono-App, Auth, Routen aus §8 des Impl-Doks), Feiertags-Sync. Endet mit lauffähigem Backend (`pnpm dev`), das per `curl` testbar ist.
