# Phase 0 — Skelett + Berechnungs-Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development (recommended) or mindCoder:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repo-Skelett plus 100% reine, voll getestete Berechnungs-Engine für Reisekontor; alle Pflicht-Testfälle aus §14.1 des Implementierungsdokuments grün.

**Architecture:** pnpm-Workspace, TypeScript strict, Vitest, Biome. `src/domain/` ist seiteneffektfrei und unabhängig von Config-Loader / DB / Server. Sätze werden als `Rates`-Parameter injiziert. Beträge in Cent (Integer). Keine UI, keine DB, kein Server in dieser Phase.

**Tech Stack:** TypeScript 5.x (strict), pnpm, Vitest, Biome, Node 22

**Spec:** [2026-06-11-phase-0-design.md](../specs/2026-06-11-phase-0-design.md)

**CWD für alle Befehle:** `c:\Projekte\Reisen\reisekontor`

---

## File-Struktur am Ende dieser Phase

```
reisekontor/
├── .gitignore
├── .env.example
├── CHANGELOG.md
├── CLAUDE.md
├── README.md
├── biome.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
├── config/
│   └── app.yaml
├── docs/
│   ├── architecture.md
│   └── mindCoder/
│       ├── plans/2026-06-11-phase-0-skelett-domain.md  (dieses Dokument)
│       └── specs/2026-06-11-phase-0-design.md          (bereits vorhanden)
├── specs/
│   ├── README.md
│   ├── domain/
│   │   └── entities.mmd
│   └── workflows/
│       └── tagestyp.mmd
└── src/
    ├── shared/
    │   ├── money.ts
    │   └── money.test.ts
    └── domain/
        ├── types.ts
        ├── pauschalen.ts
        ├── pauschalen.test.ts
        ├── trip-classify.ts
        ├── trip-classify.test.ts
        ├── plausibilitaet.ts
        └── plausibilitaet.test.ts
```

---

## Task 1: Projekt-Initialisierung (package.json, .gitignore, .env.example)

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1.1: package.json schreiben**

`package.json`:
```json
{
  "name": "reisekontor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:domain": "vitest run src/domain",
    "lint": "biome check --write src",
    "lint:check": "biome check src",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 1.2: pnpm-workspace.yaml schreiben**

`pnpm-workspace.yaml`:
```yaml
packages:
  - .
  # ui wird in Phase 2 ergänzt
```

- [ ] **Step 1.3: .gitignore schreiben**

`.gitignore`:
```
node_modules/
dist/
coverage/
.env
*.log
.DS_Store
.vscode/
.idea/
```

- [ ] **Step 1.4: .env.example schreiben**

`.env.example`:
```
# Wird in Phase 1 mit Werten gefüllt
# SESSION_SECRET=
# APP_PASSWORD_HASH=
```

- [ ] **Step 1.5: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore .env.example
git commit -m "chore: initial package + workspace + gitignore"
```

---

## Task 2: TypeScript-Setup (tsconfig)

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 2.1: tsconfig.json schreiben**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

Hinweis: `allowImportingTsExtensions: true` erlaubt `.ts`-Suffix in Imports (Vitest akzeptiert sie nativ, `tsc --noEmit` ohne diese Option würde sie ablehnen). Zwingend kombinierbar nur mit `noEmit: true`, was hier gegeben ist.

- [ ] **Step 2.2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: typescript strict config"
```

---

## Task 3: Biome-Setup (Linter + Formatter)

**Files:**
- Create: `biome.json`

- [ ] **Step 3.1: biome.json schreiben**

`biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignore": ["node_modules", "dist", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "noDefaultExport": "warn",
        "useImportType": "error"
      }
    }
  }
}
```

- [ ] **Step 3.2: Commit**

```bash
git add biome.json
git commit -m "chore: biome lint + format config"
```

---

## Task 4: Dependencies installieren + Vitest-Setup

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `vitest.config.ts`

- [ ] **Step 4.1: Dev-Dependencies installieren**

```bash
pnpm add -D typescript@^5.5.0 vitest@^2.1.0 @biomejs/biome@^1.9.0 @types/node@^22.0.0
```

Expected: pnpm-lock.yaml entsteht, `node_modules/` wird angelegt.

- [ ] **Step 4.2: vitest.config.ts schreiben**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    reporters: "default",
  },
});
```

- [ ] **Step 4.3: Smoke-Verifikation**

```bash
pnpm typecheck
pnpm lint:check
pnpm test
```

Expected:
- `typecheck`: passes (kein Code vorhanden — exit 0 ist okay)
- `lint:check`: passes (Biome findet keine Dateien zu lintn)
- `test`: meldet "No test files found, exiting with code 0" oder ähnlich. Erlaubt — wir fügen gleich Tests hinzu.

Wenn `test` mit exit-code != 0 abbricht weil keine Tests gefunden: in `vitest.config.ts` ergänzen `passWithNoTests: true` unter `test:`.

- [ ] **Step 4.4: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: install typescript, vitest, biome, node types"
```

---

## Task 5: Konfiguration & Mermaid-Specs

**Files:**
- Create: `config/app.yaml`
- Create: `specs/README.md`
- Create: `specs/domain/entities.mmd`
- Create: `specs/workflows/tagestyp.mmd`

- [ ] **Step 5.1: config/app.yaml schreiben (Sätze 2026)**

`config/app.yaml`:
```yaml
# Reisekontor — fachliche Konfiguration
# Steuersätze und Standardregeln. Werte je Steuerjahr separat ablegen.
# WICHTIG: Sätze NIE im Code hardcoden. Beträge in Cent.

jahre:
  "2026":
    kleine_cent: 1400              # 14,00 EUR — An-/Abreise, eintägig >8h
    grosse_cent: 2800              # 28,00 EUR — voller Tag (24h)
    kuerz_fruehstueck_cent: 560    # 5,60 EUR  — 20 % von 28 EUR
    kuerz_haupt_cent: 1120         # 11,20 EUR — 40 % von 28 EUR (Mittag/Abend)
    homeoffice_pro_tag_cent: 600   # 6,00 EUR
    homeoffice_max_tage: 210
    homeoffice_max_cent: 126000    # 1.260,00 EUR — Jahres-Höchstbetrag

standardwoche:                     # true = automatisch Homeoffice
  mo: true
  di: true
  mi: true
  do: true
  fr: true
  sa: false
  so: false

feiertage:
  bundesland: NI                   # Niedersachsen
```

- [ ] **Step 5.2: specs/README.md schreiben**

`specs/README.md`:
```markdown
# Spezifikation & Prozessdiagramme

## Übersicht

| Diagramm | Datei | Beschreibung |
|---|---|---|
| Domänenmodell | `domain/entities.mmd` | Tag, Reise, Settings, Satzwerk, Feiertag |
| Tagestyp-Klassifikation | `workflows/tagestyp.mmd` | Ableitung von Tagestypen in einer Reise |

## Konventionen

- Dateiendung: `.mmd`
- Jede Datei beginnt mit Kommentar: Zweck, Datum, Autor
- Flowcharts: Top-Down (`TD`)
- Max. 30 Knoten pro Diagramm
```

- [ ] **Step 5.3: specs/domain/entities.mmd schreiben**

`specs/domain/entities.mmd`:
```
%% Domänenmodell — Reisekontor
%% Erstellt: 2026-06-11
%% Beschreibung: Fachliche Kern-Entitäten. Persistenz folgt in Phase 1.

erDiagram
    TAG {
        string datum PK
        string tagestyp
        bool homeoffice
        int trip_id FK
        bool fruehstueck
        bool mittag
        bool abend
        int zuzahlung_cent
    }
    REISE {
        int id PK
        int jahr
        string start_datum
        string end_datum
        bool uebernachtung
    }
    SETTINGS {
        string key PK
        string value
    }
    SATZWERK {
        int jahr
        int kleine_cent
        int grosse_cent
        int kuerz_fruehstueck_cent
        int kuerz_haupt_cent
        int homeoffice_pro_tag_cent
        int homeoffice_max_cent
    }
    FEIERTAG {
        string datum PK
        string bezeichnung
        string bundesland
        int jahr
    }
    REISE ||--o{ TAG : "umfasst"
```

- [ ] **Step 5.4: specs/workflows/tagestyp.mmd schreiben**

`specs/workflows/tagestyp.mmd`:
```
%% Workflow — Klassifikation der Tagestypen einer Reise
%% Erstellt: 2026-06-11
%% Beschreibung: Wie classifyTrip aus (start, end, uebernachtung)
%%   die Liste der ClassifiedDay erzeugt.

flowchart TD
    A[TripInput: start, end, uebernachtung] --> B{Anzahl Kalendertage?}
    B -->|1| C{uebernachtung?}
    C -->|false| D[reise_eintaegig]
    C -->|true| E[Fehler: eintägig kann keine Übernachtung haben]
    B -->|2| F{uebernachtung?}
    F -->|false| G[reise_eintaegig auf Start-Datum<br/>Mitternachtsregelung]
    F -->|true| H[Anreise + Abreise]
    B -->|n >= 3| I{uebernachtung?}
    I -->|false| J[Fehler: mehrtägig braucht Übernachtung]
    I -->|true| K[Anreise + n-2 volle Tage + Abreise]
```

- [ ] **Step 5.5: Commit**

```bash
git add config/ specs/
git commit -m "feat: app config 2026 + domain entities + tagestyp workflow"
```

---

## Task 6: Doku (CLAUDE.md, README.md, CHANGELOG.md, docs/architecture.md)

**Files:**
- Create: `CLAUDE.md`
- Create: `README.md`
- Create: `CHANGELOG.md`
- Create: `docs/architecture.md`

- [ ] **Step 6.1: CLAUDE.md schreiben**

`CLAUDE.md` (1:1 wie Impl-Dok §5, mit kleinem Phase-0-Hinweis am Ende):
```markdown
# Reisekontor

Persoenliche Web-App zur steuerlichen Erfassung von Verpflegungsmehraufwand
und Homeoffice-Tagen. Single-User, self-hosted auf Hetzner. Kein LLM, kein Agent.

## Stack
- TypeScript (strict, ES modules) - Frontend und Backend
- UI: Vite + React + shadcn/ui + Tailwind + Recharts (Dark Mode) — ab Phase 2
- i18n: react-i18next (DE Default, EN umschaltbar) — ab Phase 2
- API: Hono - serviert JSON-API und die statische React-UI in einem Prozess — ab Phase 1
- Persistenz: SQLite via better-sqlite3 + Drizzle ORM — ab Phase 1
- Zod (Validierung) | Vitest (Tests) | Biome (Lint/Format) | pino (Logging)
- Betrieb: ein Docker-Container hinter Caddy (reisen.jans-Claude-Apps.de) — ab Phase 4

## Verzeichnisstruktur
- `src/server/` - Hono-App, Routen, Middleware (Auth, Logging) — ab Phase 1
- `src/domain/` - Berechnungs-Engine (reine Funktionen, voll getestet)
- `src/db/` - Drizzle-Schema, Migrationen, Query-Layer — ab Phase 1
- `src/config/` - YAML-Config-Loader (Saetze je Jahr, Standardwoche) — ab Phase 1
- `src/export/` - PDF/Excel/CSV-Erzeugung — ab Phase 3
- `ui/` - Vite-React-App (eigenes package.json, eigener Build) — ab Phase 2
- `specs/` - Mermaid-Diagramme (Domaene, Tagesklassifikation)

## Commands
- `pnpm dev` - Backend (Hono) mit Hot Reload — ab Phase 1
- `pnpm --filter ui dev` - UI-Dev-Server (Vite) — ab Phase 2
- `pnpm build` - UI-Build + Server-Build — ab Phase 1
- `pnpm test` - Vitest (alle Tests)
- `pnpm test:domain` - nur Berechnungs-Engine
- `pnpm lint` - Biome check + fix
- `pnpm typecheck` - tsc --noEmit
- `pnpm db:migrate` - Drizzle-Migrationen anwenden — ab Phase 1

## Architektur-Regeln
- NIEMALS `any`. Unbekannte Typen: `unknown` + Type Guards.
- Steuersaetze NIE im Code hardcoden - immer aus `config/app.yaml` je Jahr lesen.
- `src/domain/` ist rein (keine I/O, keine DB) und hat fuer jede Regel einen Test.
  Keine Geldlogik ausserhalb von `src/domain/`.
- API-Eingaben werden mit Zod validiert, bevor sie die Domaene erreichen.
- Betraege in Cent (Integer) rechnen, nicht in Float - Rundungsfehler vermeiden.
- Logging ueber pino; keine personenbezogenen Klartext-Daten in Logs.

## Konventionen
- Named Exports (kein `export default`, ausser wo Vite/React es verlangt)
- Dateien: kebab-case | Funktionen: camelCase | Typen: PascalCase
- Tests: `*.test.ts` neben der Quelldatei
- UI-Texte immer ueber i18n - kein hartkodierter String in Komponenten

## Gotchas
- Mitternachtsregelung: eintaegige Reise ueber zwei Kalendertage ohne
  Uebernachtung ergibt nur EINE kleine Pauschale (zugeordnet dem Start-Datum,
  siehe `docs/architecture.md`).
- Kuerzungen immer aus dem 28-EUR-Satz, auch bei der kleinen Pauschale.
- Urlaub/Krankheit/Feiertag duerfen NICHT in den 210-Tage-Homeoffice-Zaehler.
- Siehe `docs/architecture.md` fuer Entscheidungen, `specs/` fuer Ablaeufe.

## Phasen
Phase 0 (aktuell): Skelett + Berechnungs-Engine (kein Server, keine UI).
Phase 1: Hono + SQLite + Auth + Feiertage. Phase 2: UI. Phase 3: Export. Phase 4: Docker + Deploy.
```

- [ ] **Step 6.2: README.md schreiben**

`README.md`:
```markdown
# Reisekontor

Persönliche Web-App zur Erfassung von Verpflegungsmehraufwand und Homeoffice-Tagen für die Steuererklärung. Single-User, self-hosted.

**Status:** Phase 0 — Berechnungs-Engine. Kein lauffähiger Server, keine UI.

## Quick Start

Voraussetzungen: Node 22+, pnpm 9+.

```bash
pnpm install
pnpm test          # alle Tests
pnpm test:domain   # nur Berechnungs-Engine
pnpm lint          # Biome
pnpm typecheck     # tsc --noEmit
```

## Dokumentation

- `docs/architecture.md` — Architekturentscheidungen
- `docs/mindCoder/specs/` — Phasen-Specs
- `docs/mindCoder/plans/` — Implementierungspläne
- `specs/` — Mermaid-Diagramme (Domäne, Workflows)
- `CLAUDE.md` — Arbeitsanweisungen für Claude Code

## Stack (Endausbau)

TypeScript · Hono · SQLite + Drizzle · Vite + React + shadcn/ui · Vitest · Biome · Docker hinter Caddy.

In Phase 0 ist nur die Berechnungs-Engine (`src/domain/`) implementiert. Server, DB, UI und Deployment folgen in späteren Phasen.
```

- [ ] **Step 6.3: CHANGELOG.md schreiben**

`CHANGELOG.md`:
```markdown
# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung: [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added
- Projekt-Skelett: pnpm-Workspace, TypeScript strict, Vitest, Biome.
- `config/app.yaml` mit Sätzen 2026, Standardwoche, Bundesland NI.
- `src/shared/money.ts` — Cent-Formatierungs-Helpers.
- `src/domain/` — reine Berechnungs-Engine:
  - `types.ts` — `DayType`, `Meals`, `DayEntry`, `Rates`, `TripInput`, `ClassifiedDay`
  - `pauschalen.ts` — Kürzung, Verpflegung pro Tag, Homeoffice-Tage und -Pauschale
  - `trip-classify.ts` — Ableitung der Tagestypen aus Reisezeitraum
  - `plausibilitaet.ts` — Doppelerfassung, 8-h-Hinweis, Entfernungspauschalen-Konflikt
- Mermaid-Diagramme: `specs/domain/entities.mmd`, `specs/workflows/tagestyp.mmd`.
- Dokumentation: `CLAUDE.md`, `README.md`, `docs/architecture.md`.
- Alle Pflicht-Testfälle aus Implementierungsdokument §14.1 grün.
```

- [ ] **Step 6.4: docs/architecture.md schreiben**

`docs/architecture.md`:
```markdown
# Architektur-Entscheidungen

## Ein Container statt mehrerer Dienste

**Entscheidung:** Hono serviert API und statische UI in einem Prozess.
**Verworfen:** Separater nginx-Container für die UI.
**Warum:** Minimaler Betriebsaufwand, genau eine Komponente die laufen muss.

## Hono (TypeScript) statt FastAPI (Python)

**Entscheidung:** Backend in TypeScript via Hono.
**Warum:** Einsprachigkeit (Frontend + Backend in TS) vereinfacht Claude-Code-Generierung und Wartung. Hono ist im Agent-Template als HTTP-Layer vorgesehen.

## SQLite statt PostgreSQL

**Entscheidung:** Persistenz in einer SQLite-Datei.
**Warum:** Eine Person, geringe Datenmenge, keine Nebenläufigkeit. Dateibasiert, kein DB-Prozess, Backups sind Dateikopien.

## Beträge in Cent (Integer) statt Float

**Entscheidung:** Alle Geld-Werte sind Integer in Cent.
**Warum:** Float-Arithmetik produziert Rundungsfehler, die in einer Steueranwendung nicht akzeptabel sind. Steuerliche Korrektheit ist die wichtigste Qualitätszusage des Projekts.

## Sätze in Konfiguration statt im Code

**Entscheidung:** Steuersätze liegen je Jahr in `config/app.yaml`.
**Warum:** Sätze ändern sich jährlich. Konfigurations-Änderung ohne Code-Eingriff ist Pflicht.

## Domain ist 100 % rein

**Entscheidung:** `src/domain/` kennt keine I/O, keine DB, keinen Config-Loader. `Rates` werden als Parameter übergeben.
**Warum:** Vollständig testbar ohne Setup. Unabhängig davon, woher die Sätze kommen (YAML, DB-Override, Tenant-Konfig).

## Mitternachtsregelung — bewusste Vereinfachung

**Hintergrund:** Eine eintägige Reise ohne Übernachtung über zwei Kalendertage berechtigt zu **einer** kleinen Pauschale. Das Gesetz weist sie dem Tag mit der überwiegenden Abwesenheit zu — was Uhrzeiten voraussetzt.

**Entscheidung:** Reisekontor erfasst keine Uhrzeiten (Anforderungsdokument §1.3). Die Pauschale wird stets dem **Start-Datum** zugeordnet; der zweite Kalendertag bekommt keinen Reise-Eintrag und fällt auf den Standardwochen-Default zurück.

**Warum Start-Datum:** Bei Geschäftsreisen ist die überwiegende Aktivität typischerweise tagsüber am Anreisetag; die Nachtrückreise verschiebt nur den geografischen Aufenthalt, nicht den Geschäftszweck.

**Folge:** In seltenen Grenzfällen (z. B. Abendveranstaltung mit Übernachtungs-Verzicht und Heimkehr am frühen Folgetag) kann die Zuordnung von der Soll-Auslegung abweichen. Der Steuerberater korrigiert das im Einzelfall.
```

- [ ] **Step 6.5: Commit**

```bash
git add CLAUDE.md README.md CHANGELOG.md docs/architecture.md
git commit -m "docs: claude.md, readme, changelog, architecture decisions"
```

---

## Task 7: `src/shared/money.ts` mit Test

**Files:**
- Create: `src/shared/money.ts`
- Create: `src/shared/money.test.ts`

- [ ] **Step 7.1: Failing Test schreiben**

`src/shared/money.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatEur } from "./money.ts";

describe("formatEur", () => {
  it("formatiert null Cent als 0,00 €", () => {
    expect(formatEur(0)).toBe("0,00 €");
  });

  it("formatiert ganze Euro", () => {
    expect(formatEur(1400)).toBe("14,00 €");
  });

  it("formatiert Beträge mit Cent", () => {
    expect(formatEur(1680)).toBe("16,80 €");
  });

  it("formatiert Tausender mit Punkt", () => {
    expect(formatEur(126000)).toBe("1.260,00 €");
  });

  it("formatiert negative Beträge", () => {
    expect(formatEur(-560)).toBe("-5,60 €");
  });
});
```

- [ ] **Step 7.2: Test laufen lassen — muss fehlschlagen**

```bash
pnpm test src/shared/money.test.ts
```

Expected: FAIL — `formatEur` ist nicht definiert.

- [ ] **Step 7.3: Minimale Implementierung schreiben**

`src/shared/money.ts`:
```ts
const formatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatiert einen Cent-Wert als deutsches EUR-String ("16,80 €").
 * Eingabe in Cent (Integer), kein Float.
 */
export function formatEur(cent: number): string {
  return formatter.format(cent / 100);
}
```

- [ ] **Step 7.4: Test laufen lassen — muss passieren**

```bash
pnpm test src/shared/money.test.ts
```

Expected: PASS — alle 5 Tests grün.

Hinweis: `Intl.NumberFormat` mit `de-DE` liefert je nach Node-Version "16,80 €" oder "16,80 €" (non-breaking space). Falls Tests deshalb fehlschlagen: in der Implementierung `formatter.format(...).replace(" ", " ")` ergänzen.

- [ ] **Step 7.5: Commit**

```bash
git add src/shared/
git commit -m "feat(shared): formatEur für deutsche EUR-Anzeige aus Cent"
```

---

## Task 8: `src/domain/types.ts`

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 8.1: types.ts schreiben**

`src/domain/types.ts`:
```ts
export type DayType =
  | "homeoffice"
  | "buero"
  | "reise_anreise"
  | "reise_voll"
  | "reise_abreise"
  | "reise_eintaegig"
  | "urlaub"
  | "krankheit"
  | "feiertag";

export interface Meals {
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
}

export interface DayEntry {
  date: string; // ISO YYYY-MM-DD
  type: DayType;
  homeoffice: boolean; // Kombi-Flag: zusätzlich Homeoffice (nur bei Anreise/Abreise sinnvoll)
  meals: Meals;
  zuzahlungCent: number;
}

export interface Rates {
  kleineCent: number;
  grosseCent: number;
  kuerzFruehstueckCent: number;
  kuerzHauptCent: number;
  homeofficeProTagCent: number;
  homeofficeMaxCent: number;
}

export interface TripInput {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD (inklusiv)
  uebernachtung: boolean;
}

export interface ClassifiedDay {
  date: string;
  type: DayType;
}
```

- [ ] **Step 8.2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8.3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): kern-typen DayType, Meals, DayEntry, Rates, TripInput"
```

---

## Task 9: `pauschalen.ts` — `kuerzungCent`

**Files:**
- Create: `src/domain/pauschalen.ts`
- Create: `src/domain/pauschalen.test.ts`

- [ ] **Step 9.1: Test-Fixture für die 2026er-Sätze plus erster Failing Test**

`src/domain/pauschalen.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { kuerzungCent } from "./pauschalen.ts";
import type { Meals, Rates } from "./types.ts";

const rates2026: Rates = {
  kleineCent: 1400,
  grosseCent: 2800,
  kuerzFruehstueckCent: 560,
  kuerzHauptCent: 1120,
  homeofficeProTagCent: 600,
  homeofficeMaxCent: 126000,
};

const noMeals: Meals = { fruehstueck: false, mittag: false, abend: false };

describe("kuerzungCent", () => {
  it("liefert 0 ohne gestellte Mahlzeit", () => {
    expect(kuerzungCent(noMeals, rates2026)).toBe(0);
  });

  it("zählt nur Frühstück", () => {
    expect(kuerzungCent({ ...noMeals, fruehstueck: true }, rates2026)).toBe(560);
  });

  it("zählt nur Mittag", () => {
    expect(kuerzungCent({ ...noMeals, mittag: true }, rates2026)).toBe(1120);
  });

  it("zählt nur Abend", () => {
    expect(kuerzungCent({ ...noMeals, abend: true }, rates2026)).toBe(1120);
  });

  it("addiert alle drei Mahlzeiten", () => {
    expect(
      kuerzungCent({ fruehstueck: true, mittag: true, abend: true }, rates2026),
    ).toBe(560 + 1120 + 1120);
  });
});
```

- [ ] **Step 9.2: Failing Test verifizieren**

```bash
pnpm test src/domain/pauschalen.test.ts
```

Expected: FAIL — `kuerzungCent` nicht definiert.

- [ ] **Step 9.3: Implementierung schreiben**

`src/domain/pauschalen.ts`:
```ts
import type { Meals, Rates } from "./types.ts";

/**
 * Summe der Mahlzeitenkürzungen in Cent.
 * Kürzungssätze stets aus dem vollen Tagessatz (28 €) — auch bei der kleinen Pauschale.
 */
export function kuerzungCent(meals: Meals, rates: Rates): number {
  return (
    (meals.fruehstueck ? rates.kuerzFruehstueckCent : 0) +
    (meals.mittag ? rates.kuerzHauptCent : 0) +
    (meals.abend ? rates.kuerzHauptCent : 0)
  );
}
```

- [ ] **Step 9.4: Test laufen lassen**

```bash
pnpm test src/domain/pauschalen.test.ts
```

Expected: PASS — alle 5 Tests grün.

- [ ] **Step 9.5: Commit**

```bash
git add src/domain/pauschalen.ts src/domain/pauschalen.test.ts
git commit -m "feat(domain): kuerzungCent — mahlzeitenkürzung aus dem 28-EUR-satz"
```

---

## Task 10: `verpflegungProTagCent` — alle §14.1-Pflichtfälle

**Files:**
- Modify: `src/domain/pauschalen.ts`
- Modify: `src/domain/pauschalen.test.ts`

- [ ] **Step 10.1: Tests für die §14.1-Pflichtfälle ergänzen**

`src/domain/pauschalen.test.ts` ergänzen um folgenden Block (vor dem schließenden `});` der Datei einfügen — `describe` neu anhängen, nicht im bestehenden `describe`):

```ts
import { verpflegungProTagCent } from "./pauschalen.ts";
import type { DayEntry } from "./types.ts";

function entry(overrides: Partial<DayEntry>): DayEntry {
  return {
    date: "2026-03-04",
    type: "homeoffice",
    homeoffice: false,
    meals: { fruehstueck: false, mittag: false, abend: false },
    zuzahlungCent: 0,
    ...overrides,
  };
}

describe("verpflegungProTagCent — §14.1 Pflichtfälle", () => {
  it("Anreisetag ohne gestellte Mahlzeit → 14,00 €", () => {
    const d = entry({ type: "reise_anreise" });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1400);
  });

  it("Voller Tag, Abendessen gestellt → 28 − 11,20 = 16,80 €", () => {
    const d = entry({ type: "reise_voll", meals: { fruehstueck: false, mittag: false, abend: true } });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1680);
  });

  it("Voller Tag, Frühstück + Abendessen gestellt → 28 − 16,80 = 11,20 €", () => {
    const d = entry({ type: "reise_voll", meals: { fruehstueck: true, mittag: false, abend: true } });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1120);
  });

  it("Anreisetag, Mittag + Abend gestellt → max(14 − 22,40, 0) = 0", () => {
    const d = entry({ type: "reise_anreise", meals: { fruehstueck: false, mittag: true, abend: true } });
    expect(verpflegungProTagCent(d, rates2026)).toBe(0);
  });

  it("Eintägige Reise > 8 h, keine Mahlzeit → 14,00 €", () => {
    const d = entry({ type: "reise_eintaegig" });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1400);
  });

  it("Zuzahlung 3,00 € bei gestelltem Mittag (voller Tag) → 28 − (11,20 − 3,00) = 19,80 €", () => {
    const d = entry({
      type: "reise_voll",
      meals: { fruehstueck: false, mittag: true, abend: false },
      zuzahlungCent: 300,
    });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1980);
  });

  it("Abreisetag ohne Mahlzeit → 14,00 €", () => {
    const d = entry({ type: "reise_abreise" });
    expect(verpflegungProTagCent(d, rates2026)).toBe(1400);
  });
});

describe("verpflegungProTagCent — Nicht-Reisetage liefern 0", () => {
  it("homeoffice → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "homeoffice" }), rates2026)).toBe(0);
  });
  it("buero → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "buero" }), rates2026)).toBe(0);
  });
  it("urlaub → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "urlaub" }), rates2026)).toBe(0);
  });
  it("krankheit → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "krankheit" }), rates2026)).toBe(0);
  });
  it("feiertag → 0", () => {
    expect(verpflegungProTagCent(entry({ type: "feiertag" }), rates2026)).toBe(0);
  });
});

describe("verpflegungProTagCent — Edge Cases", () => {
  it("Zuzahlung größer als Kürzung gibt keinen Bonus (Floor bei kuerzungCent)", () => {
    const d = entry({
      type: "reise_voll",
      meals: { fruehstueck: false, mittag: true, abend: false },
      zuzahlungCent: 5000,
    });
    expect(verpflegungProTagCent(d, rates2026)).toBe(2800);
  });

  it("Kürzung über Basis hinaus → Floor bei 0, nie negativ", () => {
    const d = entry({
      type: "reise_eintaegig",
      meals: { fruehstueck: true, mittag: true, abend: true },
    });
    expect(verpflegungProTagCent(d, rates2026)).toBe(0);
  });
});
```

- [ ] **Step 10.2: Failing Tests verifizieren**

```bash
pnpm test src/domain/pauschalen.test.ts
```

Expected: FAIL — `verpflegungProTagCent` nicht definiert.

- [ ] **Step 10.3: `pauschalen.ts` ersetzen (komplette Datei)**

`src/domain/pauschalen.ts` durch folgenden vollständigen Inhalt ersetzen:
```ts
import type { DayEntry, Meals, Rates } from "./types.ts";

/**
 * Summe der Mahlzeitenkürzungen in Cent.
 * Kürzungssätze stets aus dem vollen Tagessatz (28 €) — auch bei der kleinen Pauschale.
 */
export function kuerzungCent(meals: Meals, rates: Rates): number {
  return (
    (meals.fruehstueck ? rates.kuerzFruehstueckCent : 0) +
    (meals.mittag ? rates.kuerzHauptCent : 0) +
    (meals.abend ? rates.kuerzHauptCent : 0)
  );
}

/**
 * Verpflegungspauschale eines Tages in Cent.
 * Nicht-Reisetage → 0. Kürzungs-Floor bei 0 (nie negativ). Zuzahlung kürzt
 * die Mahlzeitenkürzung, kann sie aber nicht negativ machen.
 */
export function verpflegungProTagCent(day: DayEntry, rates: Rates): number {
  const base =
    day.type === "reise_voll"
      ? rates.grosseCent
      : day.type === "reise_anreise" ||
          day.type === "reise_abreise" ||
          day.type === "reise_eintaegig"
        ? rates.kleineCent
        : 0;
  if (base === 0) return 0;
  const kuerz = Math.max(kuerzungCent(day.meals, rates) - day.zuzahlungCent, 0);
  return Math.max(base - kuerz, 0);
}
```

- [ ] **Step 10.4: Tests laufen lassen**

```bash
pnpm test src/domain/pauschalen.test.ts
```

Expected: PASS — alle bisherigen Tests grün (5 + 7 §14.1 + 5 Nicht-Reise + 2 Edge = 19).

- [ ] **Step 10.5: Commit**

```bash
git add src/domain/pauschalen.ts src/domain/pauschalen.test.ts
git commit -m "feat(domain): verpflegungProTagCent inkl. aller §14.1 pflichtfälle"
```

---

## Task 11: `homeofficeTage` + `homeofficePauschaleCent`

**Files:**
- Modify: `src/domain/pauschalen.ts`
- Modify: `src/domain/pauschalen.test.ts`

- [ ] **Step 11.1: Tests ergänzen**

In `src/domain/pauschalen.test.ts` am Ende anhängen:
```ts
import { homeofficePauschaleCent, homeofficeTage } from "./pauschalen.ts";

describe("homeofficeTage", () => {
  it("zählt reine Homeoffice-Tage", () => {
    const days = [
      entry({ date: "2026-01-05", type: "homeoffice" }),
      entry({ date: "2026-01-06", type: "homeoffice" }),
    ];
    expect(homeofficeTage(days)).toBe(2);
  });

  it("zählt Anreise- und Abreisetage mit homeoffice=true mit", () => {
    const days = [
      entry({ date: "2026-01-05", type: "reise_anreise", homeoffice: true }),
      entry({ date: "2026-01-09", type: "reise_abreise", homeoffice: true }),
    ];
    expect(homeofficeTage(days)).toBe(2);
  });

  it("zählt reise_voll mit homeoffice=true NICHT (Konflikt, Plausibilitätscheck warnt)", () => {
    const days = [
      entry({ date: "2026-01-05", type: "reise_voll", homeoffice: true }),
    ];
    expect(homeofficeTage(days)).toBe(0);
  });

  it("ignoriert Urlaub, Krankheit, Feiertag", () => {
    const days = [
      entry({ date: "2026-01-05", type: "urlaub", homeoffice: true }),
      entry({ date: "2026-01-06", type: "krankheit", homeoffice: true }),
      entry({ date: "2026-01-07", type: "feiertag", homeoffice: true }),
    ];
    expect(homeofficeTage(days)).toBe(0);
  });

  it("ignoriert Büro", () => {
    expect(homeofficeTage([entry({ type: "buero" })])).toBe(0);
  });

  it("leere Liste → 0", () => {
    expect(homeofficeTage([])).toBe(0);
  });
});

describe("homeofficePauschaleCent", () => {
  function makeDays(count: number): DayEntry[] {
    return Array.from({ length: count }, (_, i) =>
      entry({ date: `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`, type: "homeoffice" }),
    );
  }

  it("0 Tage → 0 €", () => {
    expect(homeofficePauschaleCent([], rates2026)).toBe(0);
  });

  it("1 Tag → 6 €", () => {
    expect(homeofficePauschaleCent(makeDays(1), rates2026)).toBe(600);
  });

  it("209 Tage → 1.254 €", () => {
    expect(homeofficePauschaleCent(makeDays(209), rates2026)).toBe(125400);
  });

  it("210 Tage → 1.260 € (Höchstbetrag genau erreicht)", () => {
    expect(homeofficePauschaleCent(makeDays(210), rates2026)).toBe(126000);
  });

  it("211 Tage → 1.260 € (Deckel greift)", () => {
    expect(homeofficePauschaleCent(makeDays(211), rates2026)).toBe(126000);
  });

  it("215 Tage → 1.260 € (Deckel hält)", () => {
    expect(homeofficePauschaleCent(makeDays(215), rates2026)).toBe(126000);
  });

  it("Jahr mit Urlaub/Krankheit/Feiertag — diese Tage nicht im Zähler", () => {
    const days: DayEntry[] = [
      ...makeDays(200),
      entry({ date: "2026-07-01", type: "urlaub" }),
      entry({ date: "2026-07-02", type: "krankheit" }),
      entry({ date: "2026-07-03", type: "feiertag" }),
    ];
    expect(homeofficePauschaleCent(days, rates2026)).toBe(120000);
  });

  it("Kombi-Tag (Anreise + homeoffice=true) zählt mit", () => {
    const days = [
      ...makeDays(209),
      entry({ date: "2026-12-01", type: "reise_anreise", homeoffice: true }),
    ];
    expect(homeofficePauschaleCent(days, rates2026)).toBe(126000);
  });
});
```

- [ ] **Step 11.2: Failing Tests verifizieren**

```bash
pnpm test src/domain/pauschalen.test.ts
```

Expected: FAIL — `homeofficeTage`, `homeofficePauschaleCent` nicht definiert.

- [ ] **Step 11.3: Implementierung in `pauschalen.ts` ergänzen**

In `src/domain/pauschalen.ts` am Ende anhängen:
```ts
/**
 * Anzahl der Homeoffice-Tage. Urlaub, Krankheit, Feiertag, Büro
 * und reise_voll/reise_eintaegig zählen NIE.
 */
export function homeofficeTage(days: DayEntry[]): number {
  return days.filter(
    (d) =>
      d.type === "homeoffice" ||
      (d.homeoffice &&
        (d.type === "reise_anreise" || d.type === "reise_abreise")),
  ).length;
}

/**
 * Homeoffice-Pauschale in Cent. Gedeckelt auf homeofficeMaxCent
 * (in 2026: 126.000 Cent = 1.260 € = 210 × 600).
 */
export function homeofficePauschaleCent(days: DayEntry[], rates: Rates): number {
  return Math.min(
    homeofficeTage(days) * rates.homeofficeProTagCent,
    rates.homeofficeMaxCent,
  );
}
```

- [ ] **Step 11.4: Tests laufen lassen**

```bash
pnpm test src/domain/pauschalen.test.ts
```

Expected: PASS — alle Tests grün.

- [ ] **Step 11.5: Commit**

```bash
git add src/domain/pauschalen.ts src/domain/pauschalen.test.ts
git commit -m "feat(domain): homeofficeTage + homeofficePauschaleCent mit 210-tage-deckel"
```

---

## Task 12: `trip-classify.ts`

**Files:**
- Create: `src/domain/trip-classify.ts`
- Create: `src/domain/trip-classify.test.ts`

- [ ] **Step 12.1: Tests schreiben**

`src/domain/trip-classify.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { classifyTrip } from "./trip-classify.ts";
import type { TripInput } from "./types.ts";

describe("classifyTrip — 1 Kalendertag", () => {
  it("ohne Übernachtung → reise_eintaegig", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-04", uebernachtung: false };
    expect(classifyTrip(input)).toEqual([{ date: "2026-03-04", type: "reise_eintaegig" }]);
  });

  it("mit Übernachtung → Error", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-04", uebernachtung: true };
    expect(() => classifyTrip(input)).toThrow(/eintägig kann keine Übernachtung haben/);
  });
});

describe("classifyTrip — 2 Kalendertage (Mitternachtsregelung)", () => {
  it("ohne Übernachtung → eintägig auf Start-Datum, kein Eintrag für Folgetag", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-05", uebernachtung: false };
    expect(classifyTrip(input)).toEqual([{ date: "2026-03-04", type: "reise_eintaegig" }]);
  });

  it("mit Übernachtung → Anreise + Abreise", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-05", uebernachtung: true };
    expect(classifyTrip(input)).toEqual([
      { date: "2026-03-04", type: "reise_anreise" },
      { date: "2026-03-05", type: "reise_abreise" },
    ]);
  });
});

describe("classifyTrip — 3+ Kalendertage", () => {
  it("3 Tage mit Übernachtung → Anreise + 1 voller + Abreise", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-06", uebernachtung: true };
    expect(classifyTrip(input)).toEqual([
      { date: "2026-03-04", type: "reise_anreise" },
      { date: "2026-03-05", type: "reise_voll" },
      { date: "2026-03-06", type: "reise_abreise" },
    ]);
  });

  it("7 Tage mit Übernachtung → Anreise + 5 volle + Abreise", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-10", uebernachtung: true };
    const result = classifyTrip(input);
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ date: "2026-03-04", type: "reise_anreise" });
    expect(result[6]).toEqual({ date: "2026-03-10", type: "reise_abreise" });
    for (let i = 1; i <= 5; i++) {
      expect(result[i]?.type).toBe("reise_voll");
    }
  });

  it("3 Tage ohne Übernachtung → Error", () => {
    const input: TripInput = { startDate: "2026-03-04", endDate: "2026-03-06", uebernachtung: false };
    expect(() => classifyTrip(input)).toThrow(/Mehrtägige Reise ohne Übernachtung/);
  });
});

describe("classifyTrip — Eingabevalidierung", () => {
  it("endDate vor startDate → Error", () => {
    const input: TripInput = { startDate: "2026-03-06", endDate: "2026-03-04", uebernachtung: true };
    expect(() => classifyTrip(input)).toThrow(/endDate liegt vor startDate/);
  });

  it("Monatswechsel wird korrekt durchgezählt", () => {
    const input: TripInput = { startDate: "2026-01-31", endDate: "2026-02-02", uebernachtung: true };
    expect(classifyTrip(input)).toEqual([
      { date: "2026-01-31", type: "reise_anreise" },
      { date: "2026-02-01", type: "reise_voll" },
      { date: "2026-02-02", type: "reise_abreise" },
    ]);
  });

  it("Schaltjahr 2024 — 28.02 → 29.02 → 01.03", () => {
    const input: TripInput = { startDate: "2024-02-28", endDate: "2024-03-01", uebernachtung: true };
    expect(classifyTrip(input)).toEqual([
      { date: "2024-02-28", type: "reise_anreise" },
      { date: "2024-02-29", type: "reise_voll" },
      { date: "2024-03-01", type: "reise_abreise" },
    ]);
  });
});
```

- [ ] **Step 12.2: Failing Tests verifizieren**

```bash
pnpm test src/domain/trip-classify.test.ts
```

Expected: FAIL — `classifyTrip` nicht definiert.

- [ ] **Step 12.3: Implementierung schreiben**

`src/domain/trip-classify.ts`:
```ts
import type { ClassifiedDay, TripInput } from "./types.ts";

/**
 * Klassifiziert die Tage einer Reise:
 *  - eintägig (1 Kalendertag, keine Übernachtung): nur reise_eintaegig.
 *  - eintägig über zwei Kalendertage (Mitternachtsregelung): genau eine
 *    kleine Pauschale, zugeordnet dem Start-Datum. Der zweite Kalendertag
 *    erhält KEINEN Reise-Eintrag (siehe docs/architecture.md).
 *  - mehrtägig mit Übernachtung: Anreise + n-2 volle Tage + Abreise.
 *
 * Wirft Error bei unzulässigen Eingaben (siehe specs/workflows/tagestyp.mmd).
 */
export function classifyTrip(input: TripInput): ClassifiedDay[] {
  const start = parseIso(input.startDate);
  const end = parseIso(input.endDate);
  const days = daysBetweenInclusive(start, end);

  if (days <= 0) {
    throw new Error("Ungültige Reise: endDate liegt vor startDate");
  }

  if (days === 1) {
    if (input.uebernachtung) {
      throw new Error("Ungültige Reise: eintägig kann keine Übernachtung haben");
    }
    return [{ date: input.startDate, type: "reise_eintaegig" }];
  }

  if (days === 2 && !input.uebernachtung) {
    // Mitternachtsregelung: eine kleine Pauschale auf Start-Datum
    return [{ date: input.startDate, type: "reise_eintaegig" }];
  }

  if (!input.uebernachtung) {
    throw new Error("Ungültige Reise: Mehrtägige Reise ohne Übernachtung nicht möglich");
  }

  const result: ClassifiedDay[] = [];
  for (let i = 0; i < days; i++) {
    const dateStr = formatIso(addDays(start, i));
    if (i === 0) {
      result.push({ date: dateStr, type: "reise_anreise" });
    } else if (i === days - 1) {
      result.push({ date: dateStr, type: "reise_abreise" });
    } else {
      result.push({ date: dateStr, type: "reise_voll" });
    }
  }
  return result;
}

function parseIso(s: string): Date {
  // ISO YYYY-MM-DD als UTC-Mitternacht — vermeidet TZ-Drift bei Tageszählung.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Ungültiges ISO-Datum: ${s}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function daysBetweenInclusive(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}
```

- [ ] **Step 12.4: Tests laufen lassen**

```bash
pnpm test src/domain/trip-classify.test.ts
```

Expected: PASS — alle Tests grün, inklusive Schaltjahr.

- [ ] **Step 12.5: Commit**

```bash
git add src/domain/trip-classify.ts src/domain/trip-classify.test.ts
git commit -m "feat(domain): classifyTrip — an-/abreise/voll, mitternachtsregelung, schaltjahr-safe"
```

---

## Task 13: `plausibilitaet.ts`

**Files:**
- Create: `src/domain/plausibilitaet.ts`
- Create: `src/domain/plausibilitaet.test.ts`

- [ ] **Step 13.1: Tests schreiben**

`src/domain/plausibilitaet.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { checkAll } from "./plausibilitaet.ts";
import type { DayEntry } from "./types.ts";

function entry(overrides: Partial<DayEntry>): DayEntry {
  return {
    date: "2026-03-04",
    type: "homeoffice",
    homeoffice: false,
    meals: { fruehstueck: false, mittag: false, abend: false },
    zuzahlungCent: 0,
    ...overrides,
  };
}

describe("checkAll — DOPPEL_HO_REISE_VOLL", () => {
  it("findet reise_voll-Tag mit homeoffice=true", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_voll", homeoffice: true })];
    const result = checkAll(days);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code: "DOPPEL_HO_REISE_VOLL",
      date: "2026-03-05",
      schwere: "warnung",
    });
  });

  it("reise_voll ohne homeoffice → kein Hinweis", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_voll", homeoffice: false })];
    expect(checkAll(days)).toEqual([]);
  });
});

describe("checkAll — EINTAEGIG_8H_BESTAETIGEN", () => {
  it("findet jeden reise_eintaegig-Tag", () => {
    const days = [
      entry({ date: "2026-03-05", type: "reise_eintaegig" }),
      entry({ date: "2026-03-06", type: "reise_eintaegig" }),
    ];
    const result = checkAll(days);
    const eintaegig = result.filter((h) => h.code === "EINTAEGIG_8H_BESTAETIGEN");
    expect(eintaegig).toHaveLength(2);
    expect(eintaegig[0]?.schwere).toBe("hinweis");
  });
});

describe("checkAll — HO_KONFLIKT_ENTFERNUNG", () => {
  it("findet jeden homeoffice-Tag", () => {
    const days = [
      entry({ date: "2026-03-05", type: "homeoffice" }),
      entry({ date: "2026-03-06", type: "homeoffice" }),
    ];
    const result = checkAll(days);
    const konflikt = result.filter((h) => h.code === "HO_KONFLIKT_ENTFERNUNG");
    expect(konflikt).toHaveLength(2);
    expect(konflikt[0]?.schwere).toBe("hinweis");
  });

  it("Anreise mit homeoffice=true (Kombi-Tag) löst HO_KONFLIKT aus", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_anreise", homeoffice: true })];
    const result = checkAll(days);
    expect(result.some((h) => h.code === "HO_KONFLIKT_ENTFERNUNG")).toBe(true);
  });
});

describe("checkAll — gemischt", () => {
  it("kombiniert mehrere Hinweise auf demselben Tag", () => {
    const days = [entry({ date: "2026-03-05", type: "reise_voll", homeoffice: true })];
    const result = checkAll(days);
    expect(result).toHaveLength(2);
    expect(result.map((h) => h.code).sort()).toEqual([
      "DOPPEL_HO_REISE_VOLL",
      "HO_KONFLIKT_ENTFERNUNG",
    ]);
  });

  it("leere Eingabe → leere Liste", () => {
    expect(checkAll([])).toEqual([]);
  });
});
```

- [ ] **Step 13.2: Failing Tests verifizieren**

```bash
pnpm test src/domain/plausibilitaet.test.ts
```

Expected: FAIL — `checkAll` nicht definiert.

- [ ] **Step 13.3: Implementierung schreiben**

`src/domain/plausibilitaet.ts`:
```ts
import type { DayEntry } from "./types.ts";

export type PlausibilitaetCode =
  | "DOPPEL_HO_REISE_VOLL"
  | "EINTAEGIG_8H_BESTAETIGEN"
  | "HO_KONFLIKT_ENTFERNUNG";

export type Schweregrad = "hinweis" | "warnung";

export interface PlausibilitaetHinweis {
  code: PlausibilitaetCode;
  date: string;
  schwere: Schweregrad;
}

/**
 * Liest die Tagesliste und liefert offene Plausibilitäts-Hinweise.
 * Mutiert nichts. Texte kommen später in der UI über i18n.
 */
export function checkAll(days: DayEntry[]): PlausibilitaetHinweis[] {
  const result: PlausibilitaetHinweis[] = [];
  for (const d of days) {
    if (d.type === "reise_voll" && d.homeoffice) {
      result.push({ code: "DOPPEL_HO_REISE_VOLL", date: d.date, schwere: "warnung" });
    }
    if (d.type === "reise_eintaegig") {
      result.push({ code: "EINTAEGIG_8H_BESTAETIGEN", date: d.date, schwere: "hinweis" });
    }
    if (
      d.type === "homeoffice" ||
      ((d.type === "reise_anreise" || d.type === "reise_abreise") && d.homeoffice)
    ) {
      result.push({ code: "HO_KONFLIKT_ENTFERNUNG", date: d.date, schwere: "hinweis" });
    }
  }
  return result;
}
```

- [ ] **Step 13.4: Tests laufen lassen**

```bash
pnpm test src/domain/plausibilitaet.test.ts
```

Expected: PASS — alle Tests grün.

- [ ] **Step 13.5: Commit**

```bash
git add src/domain/plausibilitaet.ts src/domain/plausibilitaet.test.ts
git commit -m "feat(domain): checkAll — plausibilitäts-hinweise als code-liste"
```

---

## Task 14: Final-Verifikation (alle Tests + Lint + Typecheck)

**Files:** keine

- [ ] **Step 14.1: Vollen Vitest-Lauf**

```bash
pnpm test
```

Expected: ALL PASS — money (5) + pauschalen (~19) + trip-classify (~11) + plausibilitaet (~7) = mindestens 40 Tests grün, 0 Failures.

Wenn ein Test fehlschlägt: zurück zum verantwortlichen Task; nicht weitermachen.

- [ ] **Step 14.2: Typecheck**

```bash
pnpm typecheck
```

Expected: keine TS-Fehler.

- [ ] **Step 14.3: Lint**

```bash
pnpm lint:check
```

Expected: keine Warnungen oder Fehler.

Falls Biome-Warnungen entstehen: `pnpm lint` (mit `--write`) ausführen, Diff prüfen, committen.

- [ ] **Step 14.4: Coverage-Stichprobe (optional aber empfohlen)**

```bash
pnpm test -- --coverage
```

Erwartung: 100 % für `src/domain/*.ts` und `src/shared/money.ts`. Falls etwas darunter liegt — fehlender Test? Ergänzen, nicht ignorieren.

- [ ] **Step 14.5: CHANGELOG.md von [Unreleased] zu [0.1.0] ziehen**

In `CHANGELOG.md`:
- Ersetze `## [Unreleased]` durch `## [0.1.0] — 2026-06-11`
- Füge darüber eine neue leere Sektion ein:
  ```markdown
  ## [Unreleased]

  ## [0.1.0] — 2026-06-11
  ```

- [ ] **Step 14.6: Phase-0-Abschluss-Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: release 0.1.0 — phase 0 complete"
git log --oneline
```

Expected: Saubere Commit-Historie auf `main`, von `docs: phase 0 design` bis `chore: release 0.1.0`.

---

## Phase-0-Abschluss-Kriterien

Alle aus dem Design-Doc §7 müssen erfüllt sein:

- [x] `pnpm install` läuft sauber durch (Task 4.1)
- [x] `pnpm test` → grün, alle §14.1-Pflichtfälle abgedeckt (Tasks 7–13, Final-Check 14.1)
- [x] `pnpm typecheck` → grün (Task 14.2)
- [x] `pnpm lint:check` → grün (Task 14.3)
- [x] `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `docs/architecture.md`, `specs/README.md` vorhanden (Tasks 5, 6)
- [x] Mermaid-Diagramme öffnen ohne Fehler (Task 5.3, 5.4)
- [x] Commit-Historie auf `main` mit klaren Schritten (jeder Task endet auf einem Commit)
