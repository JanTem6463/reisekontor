# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung: [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.2.0] — 2026-06-11

### Added
- `src/config/` — Zod-validierter YAML-Loader für `config/app.yaml`; `loadConfig()` + `ratesForYear()`.
- `src/db/` — Drizzle-Schema (`trips`, `day_entries`, `settings`), erste Migration, better-sqlite3-Client mit WAL + Foreign-Keys + idempotenten Migrationen beim `createDb`.
- `src/auth/` — argon2id-Password-Hash, HMAC-SHA256-signiertes Session-Cookie mit Timing-Safe-Verify.
- `src/server/` — Hono-App via `createServer(deps)`; Auth-Middleware schützt `/api/*` außer `/api/auth/login`; Routen `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/health`; zentraler Error-Handler; 404 für Nicht-API-Pfade.
- `src/shared/logger.ts` — pino-Logger mit Redaction für Password/Cookie/Authorization.
- `scripts/hash-password.ts` — CLI: `pnpm hash:password <plain>`.
- `scripts/run-migrations.ts` — CLI: `pnpm db:migrate`.
- Integration-Test über die komplette Login → Health → Logout Pipeline.

### Changed
- `package.json` — Version 0.2.0, neue Scripts `dev`, `db:migrate`, `db:generate`, `hash:password`. `lint`/`lint:check` decken jetzt `src tests scripts`.
- `.env.example` — dokumentierte ENV-Vars für `APP_PASSWORD_HASH`, `SESSION_SECRET`, `PORT`, `DATABASE_PATH`.
- `.gitignore` — `data/` ergänzt.

## [0.1.0] — 2026-06-11

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
