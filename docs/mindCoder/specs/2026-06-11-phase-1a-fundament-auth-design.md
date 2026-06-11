# Phase 1.A — Fundament + Auth

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Anforderungsdokument v1.0](../../../../Reisekontor_Anforderungsdokument.docx), [Implementierungsdokument v1.0](../../../../Reisekontor_Implementierungsdokument.docx), [Phase 0 Design](2026-06-11-phase-0-design.md)
**Status:** Implementierungsbereit

## 1. Zweck dieser Phase

Phase 1.A liefert das Server-Fundament: Config-Loader, SQLite-Datenbank mit Migrationen, Hono-App, Auth-Middleware mit signiertem Session-Cookie, Login/Logout-Routen und eine geschützte Health-Route. Am Ende ist `pnpm dev` ein lauffähiger Server, gegen den man sich per Passwort einloggen kann.

CRUD-Routen für Tage/Reisen/Summary/Settings folgen in Phase 1.B. Feiertags-Sync in 1.C.

## 2. Scope

### Im Scope von Phase 1.A

- `src/config/` — Zod-validierter YAML-Loader; lädt `config/app.yaml` einmalig beim Start
- `src/db/` — Drizzle-Schema (`trips`, `day_entries`, `settings`), `drizzle.config.ts`, SQL-Migrationen, better-sqlite3-Client, automatischer Migrations-Run beim Start
- `src/auth/` — argon2-Password-Hash + Verify, HMAC-signiertes Session-Cookie (Sign/Verify/Erzeugung/Parsing)
- `src/server/` — Hono-App, Auth-Middleware, zentraler Error-Handler, Routen `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/health`
- `src/shared/logger.ts` — pino-Instance mit Redaction
- Neue Dependencies: `hono`, `@hono/node-server`, `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `zod`, `yaml`, `argon2`, `pino`, `tsx`, `@types/better-sqlite3`
- Helper-Skript `scripts/hash-password.ts` (CLI: `pnpm hash:password <plain>`)
- Tests: Unit-Tests für Config-Loader, Session-Sign/Verify, Password-Hash/Verify; Integration-Test über die Login-/Health-/Logout-Pipeline
- CHANGELOG-Eintrag als `[0.2.0] — 2026-06-11`

### Out of Scope für Phase 1.A

- Routen für Tage, Reisen, Summary, Plausibilitäts-Checks, Settings (Phase 1.B)
- Feiertags-Logik via `date-holidays`, `POST /api/holidays/sync` (Phase 1.C)
- UI, statisches Hosting der Vite-Build (Phase 2)
- PDF/Excel/CSV-Exports (Phase 3)
- Docker, CI/CD, Caddy, Hetzner-Deploy (Phase 4)
- Rate-Limiting auf Login (Single-User + Caddy davor → bewusste YAGNI-Entscheidung)

## 3. Architekturentscheidungen

### 3.1 argon2 statt bcrypt für Passwort-Hashing

OWASP-Empfehlung 2026, modernere Memory-Hard-KDF, weniger Konfigurationsfallen. `argon2id` mit den `argon2.defaults` Parametern aus der `argon2`-NPM-Library — die sind seit 2022 OWASP-konform. Hash kommt aus `APP_PASSWORD_HASH` ENV. Verifikation via `argon2.verify(hash, plain)`.

### 3.2 Session-Cookie statt JWT

Single-User-App, keine Verteilung über Services. HMAC-SHA256-signiertes Cookie ist simpler und entzieht sich der JWT-Algorithmus-Confusion-Klasse.

Format: `<base64url(payload)>.<base64url(signature)>` wo `payload = JSON({exp: <epoch-seconds>})` und `signature = HMAC-SHA256(SESSION_SECRET, payload)`.

Cookie-Attribute:
- Name: `rk_session`
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production (NODE_ENV=production), nicht in dev
- `Max-Age` = 30 Tage

Logout setzt Cookie mit `Max-Age=0`.

### 3.3 Config einmal beim Start laden, dann immutable

Kein Hot-Reload, kein File-Watching. Zod-Schema validiert bei `loadConfig()`; Fehler → Server-Crash mit aufbereitetem Fehlertext. Sätze werden später (Phase 1.B) per `config.ratesForYear(2026)` von Routen gelesen.

### 3.4 better-sqlite3 synchron

Keine `await`-Acrobatics in Routen. WAL-Journal-Mode für bessere Read/Write-Concurrency (auch wenn Single-User — nichts kostet's). `PRAGMA foreign_keys = ON` beim Connection-Setup, damit der `trip_id` Foreign-Key auf `day_entries` enforced wird.

### 3.5 Migrationen beim Server-Start idempotent

`migrate()` aus `drizzle-orm/better-sqlite3/migrator` läuft beim Boot. Drizzle hält eine `__drizzle_migrations` Tabelle und überspringt bereits angewandte Migrationen. Kein separates Init-Skript nötig.

`pnpm db:migrate` als Convenience-Script existiert trotzdem (für CI/CD in Phase 4 oder manuelle Replays).

### 3.6 `DATABASE_PATH` ENV mit Default `./data/reisekontor.db`

Lokale Dev-Datei in `./data/` (gitignored). In Container (Phase 4) wird die ENV auf `/app/data/reisekontor.db` gesetzt. Verzeichnis wird vom Server angelegt, falls nicht vorhanden (`fs.mkdirSync(dir, {recursive: true})`).

### 3.7 Pino-Logging mit Redaction

Strukturierte JSON-Logs. Redact-Pfade: `password`, `passwordHash`, `cookie`, `headers.cookie`, `headers.authorization`. In dev mit `pino-pretty` lesbar (wenn das Tool installiert ist — sonst plain JSON). HTTP-Request-Logging via Hono's `logger`-Middleware, aber durch unsere pino-Wrapper.

### 3.8 Hono-Static-Hosting vorbereitet, aber kein UI-Mount in Phase 1.A

`@hono/node-server/serve-static` ist installiert (wird in Phase 2 gebraucht). Alle Nicht-API-Pfade liefern aktuell 404 mit Body `{error: "UI kommt in Phase 2"}`. Sobald Phase 2 die UI baut, wird ein Catch-All auf `public/` (oder `ui/dist/`) gemounted.

### 3.9 DB-Schema 1:1 wie Implementierungsdokument §6.1

Drei Tabellen: `trips`, `day_entries`, `settings`. Keine Schema-Erweiterung in 1.A — die Tabellen werden erst von 1.B-Routen befüllt. Aber Schema und Migration kommen jetzt, damit Phase 1.B nahtlos anschließen kann.

Felder exakt wie Impl-Dok §6.1:
- `trips`: id (PK, auto), year, start_date, end_date, uebernachtung (boolean→int)
- `day_entries`: date (PK), year, type, homeoffice (boolean→int), trip_id (FK), fruehstueck, mittag, abend (alle boolean→int), zuzahlung_cent
- `settings`: key (PK), value (JSON-serialisiert)

### 3.10 `pnpm dev` via tsx watch

`tsx watch src/server/index.ts` startet den Server mit Hot-Reload. Kein Build-Step in dev. tsx kann `.ts`-Imports und `.ts`-Suffix problemlos (passt zu unserer Phase-0-tsconfig mit `allowImportingTsExtensions: true`).

### 3.11 Auth-Middleware schützt alles unter `/api/*`, AUSSER `/api/auth/login` und `/api/health` selbst (nein — Health ist geschützt)

Klarstellung: `GET /api/health` ist nur mit gültiger Session erreichbar. Das ist absichtlich — eine öffentliche Health-Route auf der Internet-exponierten App ist ein Information-Leak. Wenn Phase 4 ein Health-Check für den Container braucht, kommt der über `docker healthcheck` mit einem internen Probe-Port, nicht über `/api/health`.

Ausnahme von der Auth: nur `POST /api/auth/login`. Logout darf gerne Auth verlangen (gestattet aber auch ohne Cookie — Idempotenz, kein Server-State zu cleanen).

## 4. Konzeptionelles Schnittstellen-Design

### 4.1 Config (`src/config/schema.ts` + `index.ts`)

```ts
// schema.ts
export const ConfigSchema = z.object({
  jahre: z.record(z.string().regex(/^\d{4}$/), z.object({
    kleine_cent: z.number().int().positive(),
    grosse_cent: z.number().int().positive(),
    kuerz_fruehstueck_cent: z.number().int().nonnegative(),
    kuerz_haupt_cent: z.number().int().nonnegative(),
    homeoffice_pro_tag_cent: z.number().int().positive(),
    homeoffice_max_tage: z.number().int().positive(),
    homeoffice_max_cent: z.number().int().positive(),
  })),
  standardwoche: z.object({
    mo: z.boolean(), di: z.boolean(), mi: z.boolean(),
    do: z.boolean(), fr: z.boolean(), sa: z.boolean(), so: z.boolean(),
  }),
  feiertage: z.object({
    bundesland: z.string().length(2),
  }),
});
export type Config = z.infer<typeof ConfigSchema>;
```

```ts
// index.ts
export interface AppConfig {
  raw: Config;
  ratesForYear(year: number): Rates;  // wirft, wenn Jahr fehlt
}

export function loadConfig(path = "config/app.yaml"): AppConfig;
```

`ratesForYear` konvertiert die Snake-Case-YAML-Felder in die Camel-Case-`Rates` aus `src/domain/types.ts`. So bleibt der YAML idiomatisch deutsch/snake_case, die Domain bleibt unverändert.

### 4.2 DB (`src/db/schema.ts` + `client.ts`)

```ts
// schema.ts
export const trips = sqliteTable("trips", { /* ... siehe Impl-Dok §6.1 */ });
export const dayEntries = sqliteTable("day_entries", { /* ... */ });
export const settings = sqliteTable("settings", { /* ... */ });
```

```ts
// client.ts
export function createDb(databasePath: string): BetterSQLite3Database;
```

`createDb` öffnet better-sqlite3, setzt `PRAGMA journal_mode = WAL` und `PRAGMA foreign_keys = ON`, läuft `migrate(...)` mit dem Migrations-Folder, gibt den Drizzle-Wrapper zurück.

### 4.3 Auth (`src/auth/password.ts` + `session.ts`)

```ts
// password.ts
export async function hashPassword(plain: string): Promise<string>;
export async function verifyPassword(hash: string, plain: string): Promise<boolean>;
```

```ts
// session.ts
export interface SessionPayload { exp: number; }
export function signSession(payload: SessionPayload, secret: string): string;
export function verifySession(token: string, secret: string): SessionPayload | null;
// null = ungültige Signatur, abgelaufen, oder Format-Fehler
```

`signSession` und `verifySession` sind synchron und reine Funktionen (testbar ohne Server-Setup).

### 4.4 Server (`src/server/index.ts`)

```ts
export function createServer(deps: {
  config: AppConfig;
  db: BetterSQLite3Database;
  passwordHash: string;
  sessionSecret: string;
  isProduction: boolean;
}): Hono;
```

Dependency Injection ermöglicht Integration-Tests, ohne Datei-/ENV-State zu manipulieren. Die Test-Suite baut sich ihren eigenen `createServer({db: inMemoryDb, ...})` zusammen.

### 4.5 Auth-Middleware (`src/server/middleware/auth.ts`)

```ts
export function authMiddleware(sessionSecret: string): MiddlewareHandler;
// Liest Cookie 'rk_session', verifiziert Signatur + Ablauf, setzt c.set('session', payload).
// Bei fehlender/ungültiger Session: 401 JSON { error: 'unauthorized' }.
```

### 4.6 Routen

```
POST /api/auth/login
  Body: { password: string }
  200: { ok: true } + Set-Cookie 'rk_session=...'
  401: { error: 'invalid_password' }

POST /api/auth/logout
  200: { ok: true } + Set-Cookie 'rk_session=; Max-Age=0'
  (akzeptiert auch ohne aktive Session)

GET /api/health
  (Auth-protected)
  200: { ok: true, version: '0.2.0', uptime_seconds: number }
```

## 5. Test-Strategie

### 5.1 Unit-Tests

- `src/config/index.test.ts`: gültige YAML lädt, ungültige YAML wirft mit Zod-Fehlermeldung; `ratesForYear` konvertiert korrekt; `ratesForYear(2099)` wirft mit klarer Message
- `src/auth/password.test.ts`: `hashPassword` produziert verschiedene Hashes bei gleichem Input (Salt); `verifyPassword` matched korrekt, abgelehnt bei Tippfehler
- `src/auth/session.test.ts`: round-trip sign → verify gibt Payload zurück; Manipulation der Payload invalidiert; abgelaufene Tokens werden abgelehnt; falsches Secret wird abgelehnt

### 5.2 Integration-Tests

`tests/server.integration.test.ts`:
- Test-DB: in-memory SQLite (`":memory:"`)
- Test-Config: gehärtetes Fixtures-Objekt mit 2026er-Sätzen
- Hono `app.request(...)` als Test-Driver (kein echter Port)
- Szenarien:
  1. `GET /api/health` ohne Cookie → 401
  2. `POST /api/auth/login` mit korrektem Passwort → 200 + Set-Cookie
  3. `POST /api/auth/login` mit falschem Passwort → 401
  4. `GET /api/health` mit gültigem Cookie → 200, Body enthält `ok: true, version`
  5. `POST /api/auth/logout` → 200 + Cookie cleared
  6. Logout-Cookie wiederverwenden → 401 (Cookie-Wert ist leer)

### 5.3 Manuelle Smoke (am Ende von Phase 1.A)

`scripts/hash-password.ts` lokal ausführen, Hash in `.env` setzen, `pnpm dev` starten, mit `curl` die vier Szenarien durchspielen.

## 6. Konfiguration & Environment

### 6.1 `.env.example` Update

```
# Application-Passwort (argon2-Hash). Erzeugen mit:
#   pnpm hash:password <plain>
APP_PASSWORD_HASH=

# Session-Cookie Signatur. Mindestens 32 Zeichen. Erzeugen mit:
#   node -e "console.log(crypto.randomBytes(32).toString('hex'))"
SESSION_SECRET=

# Optional, Default 3030
PORT=3030

# Optional, Default ./data/reisekontor.db
DATABASE_PATH=
```

### 6.2 `package.json` Scripts (neu)

```json
{
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "db:migrate": "tsx scripts/run-migrations.ts",
    "db:generate": "drizzle-kit generate",
    "hash:password": "tsx scripts/hash-password.ts"
  }
}
```

### 6.3 `drizzle.config.ts`

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
});
```

## 7. Abschluss-Kriterien Phase 1.A

- [ ] `pnpm install` läuft sauber durch
- [ ] `pnpm dev` startet Server auf Port 3030, startet ohne Crash mit gültiger `.env`
- [ ] Server crasht mit klarer Fehlermeldung bei fehlender/ungültiger Config oder fehlenden ENV-Vars
- [ ] `pnpm test` → alle Phase-0-Tests (56) + neue Unit-Tests + Integration-Test grün
- [ ] `pnpm typecheck` → grün
- [ ] `pnpm lint:check` → grün
- [ ] `.env.example` enthält dokumentierte ENV-Vars
- [ ] `scripts/hash-password.ts` erzeugt argon2-Hash für ein Klartext-Passwort
- [ ] `data/` in `.gitignore` ergänzt
- [ ] CHANGELOG `[0.2.0] — 2026-06-11` mit Auflistung
- [ ] Erfolgreicher manueller Login → Health → Logout per curl
- [ ] Commit-Historie auf `main` mit klaren Schritten

## 8. Nächste Phase

Phase 1.B: CRUD-Routen für `/api/days`, `/api/trips`, `/api/summary`, `/api/checks`, `/api/settings`. Service-Layer zwischen Routen und DB, damit die Domain-Engine als Input dienen kann. Endet mit vollständig per `curl` testbarem Backend.
