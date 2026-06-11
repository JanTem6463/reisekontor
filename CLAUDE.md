# Reisekontor

Persönliche Web-App zur steuerlichen Erfassung von Verpflegungsmehraufwand
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
- `src/config/` - YAML-Config-Loader (Sätze je Jahr, Standardwoche) — ab Phase 1
- `src/export/` - PDF/Excel/CSV-Erzeugung — ab Phase 3
- `ui/` - Vite-React-App (eigenes package.json, eigener Build) — ab Phase 2
- `specs/` - Mermaid-Diagramme (Domäne, Tagesklassifikation)

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
- Steuersätze NIE im Code hardcoden - immer aus `config/app.yaml` je Jahr lesen.
- `src/domain/` ist rein (keine I/O, keine DB) und hat für jede Regel einen Test.
  Keine Geldlogik außerhalb von `src/domain/`.
- API-Eingaben werden mit Zod validiert, bevor sie die Domäne erreichen.
- Beträge in Cent (Integer) rechnen, nicht in Float - Rundungsfehler vermeiden.
- Logging über pino; keine personenbezogenen Klartext-Daten in Logs.

## Konventionen
- Named Exports (kein `export default`, außer wo Vite/React es verlangt)
- Dateien: kebab-case | Funktionen: camelCase | Typen: PascalCase
- Tests: `*.test.ts` neben der Quelldatei
- UI-Texte immer über i18n - kein hartkodierter String in Komponenten

## Gotchas
- Mitternachtsregelung: eintägige Reise über zwei Kalendertage ohne
  Übernachtung ergibt nur EINE kleine Pauschale (zugeordnet dem Start-Datum,
  siehe `docs/architecture.md`).
- Kürzungen immer aus dem 28-EUR-Satz, auch bei der kleinen Pauschale.
- Urlaub/Krankheit/Feiertag dürfen NICHT in den 210-Tage-Homeoffice-Zähler.
- Siehe `docs/architecture.md` für Entscheidungen, `specs/` für Abläufe.

## Phasen
Phase 0 (aktuell): Skelett + Berechnungs-Engine (kein Server, keine UI).
Phase 1: Hono + SQLite + Auth + Feiertage. Phase 2: UI. Phase 3: Export. Phase 4: Docker + Deploy.
