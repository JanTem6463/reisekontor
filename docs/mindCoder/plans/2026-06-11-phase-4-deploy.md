# Phase 4 — Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development.

**Goal:** Reisekontor unter `https://reisen.jans-Claude-Apps.de` deploybar — Multi-Stage Dockerfile, compose-Stack, Caddy-Snippet, GitHub Actions CI+Deploy, Runbook, GitHub-Repo + Initial-Push. **Kein Backup.**

**Architecture:** tsx in Production (kein TS-Build), Hono serviert statisch ausgelieferte UI aus `/app/public/` mit SPA-Fallback, docker-compose mit Bind `127.0.0.1:8082`, Caddy auf der bestehenden Box reverse-proxyt davor.

**Tech Stack ergänzt:** Docker Multi-Stage Build, GitHub Actions, `@hono/node-server/serve-static`.

**Spec:** [2026-06-11-phase-4-deploy-design.md](../specs/2026-06-11-phase-4-deploy-design.md)

**CWD:** `c:\Projekte\Reisen\reisekontor`

---

## Task 1: Dockerfile + .dockerignore + docker-compose + Caddyfile-Snippet

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker/docker-compose.yaml`
- Create: `docker/Caddyfile.snippet`
- Create: `.dockerignore`
- Modify: `.env.example`

- [ ] **Step 1.1: `.dockerignore`**

```
node_modules
**/node_modules
.git
.gitignore
.env
.env.local
data
coverage
dist
ui/dist
*.tsbuildinfo
.vscode
.idea
docs/mindCoder
**/*.test.ts
tests
```

- [ ] **Step 1.2: `docker/Dockerfile`**

```dockerfile
# ---- Stage 1: UI build ----
FROM node:22-alpine AS ui-builder
WORKDIR /build
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ui/package.json ./ui/
RUN pnpm install --frozen-lockfile --filter @reisekontor/ui...

COPY ui/ ./ui/
RUN pnpm --filter @reisekontor/ui build

# ---- Stage 2: Server deps ----
FROM node:22-alpine AS deps
WORKDIR /build
RUN corepack enable

# Build-Tools für better-sqlite3 native-binding
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ui/package.json ./ui/
# Nur Root-Workspace prod-deps; UI wird in Stage 1 fertig gebaut und als statische Files kopiert
RUN pnpm install --frozen-lockfile --prod --filter "!@reisekontor/ui"

# ---- Stage 3: Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production-deps + tsx als Runtime
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/package.json ./

# Source-Code (tsx serviert direkt aus src/)
COPY src ./src
COPY config ./config

# UI-Build als statische Files
COPY --from=ui-builder /build/ui/dist ./public

# Daten-Verzeichnis
RUN mkdir -p /app/data && chown -R node:node /app/data /app

USER node
EXPOSE 3030

CMD ["node", "node_modules/.bin/tsx", "src/server/index.ts"]
```

Hinweis: `corepack enable` aktiviert pnpm im alpine-Image. `--filter "!@reisekontor/ui"` schließt das UI-Workspace bei prod-deps aus. Falls `tsx` als Dev-Dep markiert ist: wir müssen es in `package.json` zu den dependencies hochziehen (aus devDependencies → dependencies), damit `--prod` es behält. Alternativ: `pnpm install --frozen-lockfile` (ohne `--prod`) — größeres Image, einfacher.

**Pragmatisch im Plan:** beim Bauen testen, ob `tsx` nach `--prod`-install fehlt. Falls ja, in `package.json` umziehen.

- [ ] **Step 1.3: `docker/docker-compose.yaml`**

```yaml
services:
  reisekontor:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    image: reisekontor:latest
    container_name: reisekontor
    env_file:
      - ../.env
    environment:
      - NODE_ENV=production
      - APP_CONFIG_PATH=/app/config/app.yaml
      - DATABASE_PATH=/app/data/reisekontor.db
      - PORT=3030
    volumes:
      - reisekontor-data:/app/data
    ports:
      - "127.0.0.1:8082:3030"
    restart: unless-stopped

volumes:
  reisekontor-data:
```

- [ ] **Step 1.4: `docker/Caddyfile.snippet`**

```caddy
# An den bestehenden Caddyfile-Eintrag der Hetzner-Box anhängen.
# Caddy holt das TLS-Zertifikat automatisch über Let's Encrypt,
# sobald ein A-Record für reisen.jans-Claude-Apps.de existiert.

reisen.jans-Claude-Apps.de {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8082

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "no-referrer"
  }
}
```

- [ ] **Step 1.5: `.env.example` erweitern**

Bestehender Inhalt behalten, ergänzen am Ende:
```
# Production-Hinweise:
# - In Production NODE_ENV=production setzen (wird von docker-compose erzwungen).
# - APP_CONFIG_PATH = /app/config/app.yaml (im Container).
# - DATABASE_PATH = /app/data/reisekontor.db (im Container).
# - PORT = 3030 (intern; Caddy proxyt von 8082 → 3030).
NODE_ENV=
```

- [ ] **Step 1.6: Commit**

```bash
git add docker/ .dockerignore .env.example
git commit -m "feat(deploy): multi-stage dockerfile + compose + caddy-snippet

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Server-Update für serveStatic + SPA-Fallback

**Files:**
- Modify: `src/server/index.ts`
- Modify: `package.json` (if `tsx` needs to be a prod-dep)

- [ ] **Step 2.1: tsx prüfen**

In `package.json` schauen, wo `tsx` aktuell steht. Wenn in `devDependencies`, umziehen nach `dependencies`. (Das ist nötig damit `pnpm install --prod` es behält.)

```bash
node -e "const p=require('./package.json'); console.log('dev:', !!p.devDependencies?.tsx, 'prod:', !!p.dependencies?.tsx);"
```

Wenn `dev: true, prod: false`: in `package.json` editieren, Eintrag aus `devDependencies` nach `dependencies` verschieben. Dann `pnpm install` einmal aktualisiert das Lockfile.

- [ ] **Step 2.2: `src/server/index.ts` erweitern**

Aktueller Inhalt zeigt nach den routes ein `app.notFound(...)`. Ersetze diesen Block durch:

```ts
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ... bestehende Imports + ServerDeps ...

export function createServer(deps: ServerDeps): Hono {
  const app = new Hono();

  app.use("*", requestLogger());

  app.route("/api/auth", createAuthRouter({...}));
  app.use("/api/*", authMiddleware(deps.sessionSecret));

  app.route("/api/health", createHealthRouter());
  app.route("/api/days", createDaysRouter({db: deps.db}));
  app.route("/api/trips", createTripsRouter({db: deps.db}));
  app.route("/api/summary", createSummaryRouter({db: deps.db, config: deps.config}));
  app.route("/api/holidays", createHolidaysRouter({db: deps.db, config: deps.config}));
  app.route("/api/checks", createChecksRouter({db: deps.db}));
  app.route("/api/settings", createSettingsRouter({db: deps.db, config: deps.config}));
  app.route("/api/export", createExportRouter({db: deps.db, config: deps.config}));

  // Statische UI-Dateien (Production) — nur wenn ./public existiert
  const publicDir = process.env.STATIC_DIR ?? "./public";
  let indexHtml: string | null = null;
  try {
    indexHtml = readFileSync(join(publicDir, "index.html"), "utf8");
  } catch {
    // dev mode: keine statische UI im Server
  }

  if (indexHtml !== null) {
    app.use("/*", serveStatic({ root: publicDir }));
    // SPA-Fallback: alles, was nicht /api/* und nicht statisch gefunden wurde → index.html
    app.notFound((c) => {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.html(indexHtml ?? "");
    });
  } else {
    // Dev-Modus: notFound bleibt wie vorher
    app.notFound((c) =>
      c.json({ error: "not_found", hint: "UI über Vite-Dev-Server (Port 5174)" }, 404),
    );
  }

  app.onError((err, c) => {
    appLogger.error({ err: err.message, path: c.req.path }, "request failed");
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
```

Wichtig: Der Static-Mount + SPA-Fallback **darf nur greifen**, wenn `./public/index.html` tatsächlich existiert. Im Dev (kein Build) kein Mount, sodass Tests unverändert grün bleiben.

- [ ] **Step 2.3: Smoke**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Alle exit 0. Test count: 173.

- [ ] **Step 2.4: Commit**

```bash
git add src/server/index.ts package.json pnpm-lock.yaml
git commit -m "feat(server): serveStatic + spa-fallback für production-ui, tsx als prod-dep

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: GitHub Actions ci.yml + deploy.yml + Runbook

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `docs/runbook.md`

- [ ] **Step 3.1: `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck (backend)
        run: pnpm typecheck

      - name: Typecheck (UI)
        run: pnpm typecheck:ui

      - name: Lint (backend)
        run: pnpm lint:check

      - name: Lint (UI)
        run: pnpm lint:ui

      - name: Test (backend)
        run: pnpm test

      - name: Build UI
        run: pnpm build:ui
```

- [ ] **Step 3.2: `.github/workflows/deploy.yml`**

```yaml
name: deploy

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ${{ secrets.HETZNER_USER }}
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            set -e
            cd /opt/reisekontor
            git fetch origin main
            git reset --hard origin/main
            docker compose -f docker/docker-compose.yaml up -d --build
            docker compose -f docker/docker-compose.yaml ps
```

Hinweis: `git reset --hard origin/main` ist absichtlich destructiv (keine lokalen Edits auf der Box). Falls jemand auf der Box editiert hat → wird überschrieben.

- [ ] **Step 3.3: `docs/runbook.md`**

```markdown
# Reisekontor — Runbook

## Erstmaliger Setup auf der Hetzner-Box

1. SSH zur Box als deploy-User
2. Verzeichnis anlegen:
   ```bash
   sudo mkdir /opt/reisekontor
   sudo chown $USER:$USER /opt/reisekontor
   cd /opt/reisekontor
   ```
3. Repo clonen:
   ```bash
   git clone git@github.com:<owner>/reisekontor.git .
   ```
4. `.env` erstellen (lokal die Werte erzeugen):
   - APP_PASSWORD_HASH: lokal `pnpm hash:password <plain>` ausführen, Hash kopieren
   - SESSION_SECRET: lokal `openssl rand -hex 32`
   - Auf der Box: `nano .env` und einfügen (siehe `.env.example`)
   - **Wichtig: argon2-Hash mit `$`-Zeichen single-quoten in `.env`**
5. Container starten:
   ```bash
   docker compose -f docker/docker-compose.yaml up -d --build
   ```
6. Caddyfile-Eintrag anhängen:
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```
   Inhalt aus `docker/Caddyfile.snippet` ans Ende anhängen.
7. Caddy reloaden:
   ```bash
   sudo systemctl reload caddy
   ```
8. DNS-Record im Hetzner-Console / DNS-Provider setzen:
   - Typ: A
   - Name: reisen.jans-Claude-Apps.de
   - Wert: <Hetzner-IP>
9. Warten bis Caddy TLS-Zertifikat geholt hat (1-2 Min).
10. Browser: `https://reisen.jans-Claude-Apps.de` → Login mit dem Passwort, das in Schritt 4 in einen Hash umgewandelt wurde.

## GitHub Repo Secrets

Im GitHub-Repo unter Settings → Secrets:
- `HETZNER_HOST` — IP oder Hostname der Box
- `HETZNER_USER` — Username (z.B. `deploy`)
- `HETZNER_SSH_KEY` — Private-Key für SSH (muss als Public-Key in `~/.ssh/authorized_keys` auf der Box stehen)

Der `deploy`-User muss Mitglied der `docker`-Group sein: `sudo usermod -aG docker deploy`.

## Deploy-Loop

Nach Push auf `main`:
1. CI läuft automatisch (lint + tests + ui-build)
2. Wenn CI grün → manuell triggern:
   ```bash
   gh workflow run deploy.yml
   ```
3. Status:
   ```bash
   gh run list --workflow=deploy.yml
   ```

## Rollback

Auf der Box:
```bash
cd /opt/reisekontor
git log --oneline -10                # finde gewünschten Commit
git reset --hard <commit-sha>
docker compose -f docker/docker-compose.yaml up -d --build
```

## Manueller Snapshot (kein Cron)

```bash
docker run --rm \
  -v reisekontor-data:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/reisekontor-backup-$(date +%F).tar.gz /data
```

Restore:
```bash
docker compose -f docker/docker-compose.yaml down
docker volume rm reisekontor-data
docker volume create reisekontor-data
docker run --rm \
  -v reisekontor-data:/data \
  -v $(pwd):/backup \
  alpine \
  tar xzf /backup/reisekontor-backup-YYYY-MM-DD.tar.gz -C /
docker compose -f docker/docker-compose.yaml up -d
```

## Logs ansehen

```bash
docker compose -f docker/docker-compose.yaml logs -f reisekontor
```

## App stoppen

```bash
docker compose -f docker/docker-compose.yaml down
```

## Passwort ändern

1. Lokal: `pnpm hash:password <neues_passwort>` → Hash kopieren
2. Box: `nano /opt/reisekontor/.env` → APP_PASSWORD_HASH ersetzen
3. `docker compose -f docker/docker-compose.yaml restart reisekontor`
```

- [ ] **Step 3.4: Commit**

```bash
git add .github/ docs/runbook.md
git commit -m "feat(deploy): github actions ci + deploy workflows + runbook

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: GitHub-Repo anlegen + Initial-Push

**Files:** keine

- [ ] **Step 4.1: gh CLI prüfen**

```bash
gh --version
gh auth status
```

Wenn `gh` nicht authed: `gh auth login` durchführen (interaktiv). Implementer soll BLOCKED reporten falls nicht möglich.

- [ ] **Step 4.2: Repo anlegen + Push**

```bash
gh repo create reisekontor \
  --private \
  --source . \
  --push \
  --description "Reisekontor — persönliche Reisekosten- und Homeoffice-Erfassung"
```

Das pusht den `main`-Branch mit allen 90+ Commits. Bei Erfolg: Repo-URL wird ausgegeben.

- [ ] **Step 4.3: Verifikation**

```bash
git remote -v
gh repo view
```

`main` ist `up-to-date with 'origin/main'`. CI sollte sofort laufen — kann via `gh run list` geprüft werden.

- [ ] **Step 4.4: Commit-Push falls noch nicht erfolgt**

Wenn aus irgendeinem Grund der Initial-Push nicht alles mitgenommen hat:
```bash
git push -u origin main
```

---

## Task 5: Lokaler Docker-Smoke

**Files:** ggf. Bugfixes

- [ ] **Step 5.1: Docker-Build**

```bash
cd docker
docker compose build 2>&1 | tee /tmp/rk-build.log
```

Erwartung: build success. Falls Build fehlschlägt:
- `better-sqlite3`: prüfen ob native-binding klappt. Wenn nicht, build-tools im deps-Stage prüfen.
- pnpm `--filter` Probleme: alternative Variante ohne `--prod` versuchen.
- `tsx` fehlt: in `package.json` zu dependencies hochziehen.

Bei Erfolg: Image-Größe via `docker images reisekontor` prüfen — sollte unter 500 MB liegen.

- [ ] **Step 5.2: .env für lokalen Smoke**

Eine temporäre `.env` neben `docker/` (Pfad: `c:\Projekte\Reisen\reisekontor\.env`) muss existieren mit:
```
APP_PASSWORD_HASH=<existing argon2 hash>
SESSION_SECRET=<existing 64-char hex>
NODE_ENV=production
```

Diese .env existiert schon aus Phase 1.A — prüfen ob NODE_ENV=production gesetzt wird (oder ENV durch compose-Override gesetzt — ja, das macht der `environment`-Block).

- [ ] **Step 5.3: Container starten**

```bash
cd docker
docker compose up -d
docker compose ps
```

Status sollte "running" und "healthy" (oder ohne healthcheck einfach "running") sein.

- [ ] **Step 5.4: Curl-Smoke**

```bash
# Health ohne cookie → 401 (server lebt)
curl -i http://localhost:8082/api/health

# Login
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"password":"test123"}' \
  http://localhost:8082/api/auth/login -c /tmp/rk-prod-cookie.txt

# Health mit cookie → 200 + version: 0.9.0
curl -i -b /tmp/rk-prod-cookie.txt http://localhost:8082/api/health

# Statische UI → HTML
curl -s http://localhost:8082/ | head -c 200
# Expected: HTML mit <title>Reisekontor</title>

# Statische Asset (index.css o.ä.)
curl -i http://localhost:8082/assets/index-XXX.js | head -1
# Expected: 200
```

Wenn alles funktioniert: container stoppen.
```bash
docker compose down
```

- [ ] **Step 5.5: Cleanup + Commit (falls Bugfixes)**

Falls Anpassungen am Dockerfile/Server nötig waren:
```bash
git add docker/Dockerfile src/server/index.ts ...
git commit -m "fix(deploy): <was war>"
```

- [ ] **Step 5.6: Smoke-Erfolg dokumentieren**

Im Report: tatsächliche Image-Größe, Startup-Zeit (von `docker compose up` bis ready-log), Curl-Erfolge.

---

## Task 6: Release 0.9.0

**Files:**
- Modify: `CHANGELOG.md`
- Modify: root + ui `package.json`

- [ ] **Step 6.1: CHANGELOG**

In `CHANGELOG.md` über `## [0.8.0]`:
```markdown
## [Unreleased]

## [0.9.0] — 2026-06-11

### Added
- `docker/Dockerfile` Multi-Stage: UI-Build (pnpm) + Server-Deps + Runtime mit tsx.
- `docker/docker-compose.yaml` mit reisekontor-Service, Volume `reisekontor-data`, Port-Bind `127.0.0.1:8082:3030`, `restart: unless-stopped`.
- `docker/Caddyfile.snippet` als Reference-Konfig für die Hetzner-Box (Caddy auto-TLS).
- `.dockerignore`.
- `.github/workflows/ci.yml` — lint + typecheck + tests + ui-build auf jedem Push.
- `.github/workflows/deploy.yml` — manueller SSH-Deploy zu Hetzner via `workflow_dispatch`.
- `docs/runbook.md` — Initial-Setup + Deploy-Loop + Rollback + manueller Snapshot + Passwort-Wechsel.
- GitHub-Repo `reisekontor` (privat) angelegt + initial-push.

### Changed
- `src/server/index.ts` — `serveStatic` für `./public/` + SPA-Fallback (nur wenn `index.html` existiert; Dev bleibt unverändert).
- `package.json` — `tsx` von devDependencies nach dependencies verschoben (Production-Runtime).
- `.env.example` — Production-Hinweise ergänzt.
- `package.json` + `ui/package.json` — Version 0.9.0.

### Out of Scope (bewusst)
- Backup-Cron (User-Entscheidung).
- Disaster-Recovery-Automation.
- Monitoring/Alerting.
```

- [ ] **Step 6.2: Versionsbump**

Root + `ui/package.json`: `"version": "0.8.0"` → `"0.9.0"`.

- [ ] **Step 6.3: Final-Smoke**

```bash
pnpm test
pnpm typecheck
pnpm typecheck:ui
pnpm lint:check
pnpm lint:ui
```

Alle exit 0. Tests: 173.

- [ ] **Step 6.4: Release-Commit + Push**

```bash
git add CHANGELOG.md package.json ui/package.json
git commit -m "chore: release 0.9.0 — phase 4 deploy-ready"
git push origin main
```

Push triggert CI auf GitHub.

- [ ] **Step 6.5: CI-Status prüfen**

```bash
gh run list --workflow=ci.yml
gh run watch
```

CI sollte grün durchlaufen — falls rot, fixen + push.

---

## Phase-4-Abschluss-Kriterien

- [x] Lokaler `docker compose up --build` funktioniert (Task 5)
- [x] Curl-Smoke: 401 ohne Cookie, 200 mit Cookie, UI als HTML auf `/`
- [x] GitHub-Repo + alle Commits gepusht (Task 4)
- [x] CI-Workflow grün auf GitHub (Task 6.5)
- [x] Runbook + Caddy-Snippet committed
- [x] CHANGELOG `[0.9.0]`
- [x] Backend-Tests bleiben 173 grün

**Hetzner-Box-Setup ist User-Schritt** — der User folgt dem Runbook und führt es selbst auf der Box durch.
