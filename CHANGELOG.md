# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung: [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.5.0] — 2026-06-11

### Added
- `ui/` — neuer pnpm-Workspace mit Vite + React 19 + TypeScript strict.
- `ui/src/lib/api.ts` — typisierter API-Client mit `ApiError`/`UnauthorizedError`/`NetworkError`.
- `ui/src/lib/i18n.ts` — react-i18next mit DE als Default und EN als Switch (`ui/src/locales/{de,en}.json`).
- `ui/src/lib/theme.ts` — Dark/Light-Toggle, persistiert in `localStorage['rk-theme']`.
- Tailwind CSS 3.4 mit Dark-Mode (class-based, Default dark) und shadcn/ui-Basis-Komponenten (button, input, label, card, sonner).
- React-Router v6 mit `/login` (öffentlich) + `/uebersicht`/`/reisen`/`/export`/`/einstellungen` (auth-protected via `ProtectedLayout`).
- `LoginPage` mit POST `/api/auth/login`-Integration + Toast-Feedback bei falschem Passwort.
- `TopBar` mit Sprach-Switcher, Theme-Toggle und Logout.
- `NavTabs` mit aktivem-Tab-Highlight.
- Vite-Dev-Proxy: `/api` → `http://localhost:3030`.

### Changed
- `package.json` — Version 0.5.0, neue Scripts `dev:ui`, `build:ui`, `typecheck:ui`, `lint:ui`.
- `pnpm-workspace.yaml` — `ui` als zweiter Workspace.
- `biome.json` — `ui/dist` und `ui/node_modules` ignoriert.
- `.gitignore` — `ui/dist/`, `ui/*.tsbuildinfo`, `ui/vite.config.{d.ts,js}` ergänzt.

## [0.4.0] — 2026-06-11

### Added
- `src/services/holidays.ts` — `syncHolidaysForYear(db, year, bundesland)` mit Cleanup + Idempotenz + User-Override-Respekt; explizite Validierung des Bundeslandes gegen `date-holidays.getStates("DE")`.
- `src/services/checks.ts` — `checkYear(db, year)` wrappt `plausibilitaet.checkAll()` der Domain.
- `src/server/routes/holidays.ts` — `POST /api/holidays/sync?year`.
- `src/server/routes/checks.ts` — `GET /api/checks?year`.
- Dependency `date-holidays@3.30.2` für gesetzliche Feiertage je Bundesland (Filter auf `type: "public"`).
- Integration-Tests für `/api/holidays/sync` und `/api/checks`.

### Changed
- `package.json` — Version 0.4.0.
- `src/server/index.ts` — neue Routen `/api/holidays` und `/api/checks` unter `authMiddleware` registriert.
- `vitest.config.ts` — `testTimeout: 30000` (war Default 5000); argon2-Hashing in `beforeAll` mehrerer Integration-Test-Files braucht mehr Headroom unter paralleler Last.

## [0.3.0] — 2026-06-11

### Added
- `src/services/` — Service-Layer als pure functions:
  - `mappers.ts` — DB-Row ↔ Domain-DayEntry-Konversion.
  - `days.ts` — list/get/upsert/delete für Tageseinträge.
  - `trips.ts` — list/get/create/update (Hart-Reset)/delete für Reisen, transaktional.
  - `summary.ts` — `computeSummary()` für Jahres-Kennzahlen (Verpflegung, HO-Tage/-Betrag, Reisetage nach Typ).
- `src/server/routes/days.ts` — `GET /api/days?year`, `PUT /api/days/:date`, `DELETE /api/days/:date` mit Validierung für Reise-Tage und Kombi-Tage.
- `src/server/routes/trips.ts` — `GET /api/trips?year`, `GET /api/trips/:id`, `POST /api/trips`, `PUT /api/trips/:id`, `DELETE /api/trips/:id`.
- `src/server/routes/summary.ts` — `GET /api/summary?year`.
- `src/server/middleware/request-logger.ts` — pino-basiertes Request-Logging (method, path, status, duration_ms).
- Integration-Tests für `/api/days`, `/api/trips`, `/api/summary`.

### Changed
- `package.json` — Version 0.3.0.
- `src/server/index.ts` — neue Routen registriert, Request-Logger als erste Middleware eingehängt.

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
