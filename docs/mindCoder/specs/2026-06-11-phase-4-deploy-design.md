# Phase 4 — Deploy auf Hetzner

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Implementierungsdokument §15-§17](../../../../Reisekontor_Implementierungsdokument.docx), Memory `hetzner-deploy-finanz` (Box-Vorbild)
**Status:** Implementierungsbereit

## 1. Zweck

Phase 4 macht Reisekontor unter `https://reisen.jans-Claude-Apps.de` produktiv erreichbar. Multi-Stage Docker-Image, docker-compose-Stack, Caddy-Eintrag als Snippet im Repo, GitHub Actions CI + manueller Deploy-Workflow. **Backup-Cron explizit out-of-scope** (User-Entscheidung).

Hetzner-Box ist die bestehende CPX21, auf der bereits `finanz-app` produktiv läuft. Phase-1-Security der Box ist abgeschlossen (Firewall 22/80/443, SSH-Hardening, fail2ban). Wir installieren keine neue VM — wir hängen einen zweiten Container an einen bestehenden Caddy.

## 2. Scope

### Im Scope

- `docker/Dockerfile` Multi-Stage: UI-Build + Server-Runtime
- `docker/docker-compose.yaml` mit reisekontor-Service + Volume + lokal-bind 8082
- `docker/Caddyfile.snippet` als Reference-Konfig für den Box-Caddy
- `.dockerignore`
- `.env.example` für Produktion erweitert (`NODE_ENV`, Hinweise)
- `.github/workflows/ci.yml` — Lint + Typecheck + Tests + UI-Build auf jedem Push
- `.github/workflows/deploy.yml` — manuell triggerbar (`workflow_dispatch`), SSH zu Hetzner, `git pull && docker compose up -d --build`
- `docs/runbook.md` — Initial-Setup auf Hetzner + Deploy-Loop + Rollback
- GitHub-Repo `reisekontor` (privat) angelegt + initial-push
- Lokaler Docker-Smoke: `docker compose up --build` → curl funktioniert gegen `localhost:8082`
- README aktualisiert mit Production-Hinweisen
- CHANGELOG `[0.9.0]`

### Out of Scope (User-Entscheidung "ohne Backup")

- Backup-Cron mit `sqlite3 .backup` und Rotation
- Off-site-Backup (S3/B2/Hetzner-Storage)
- Disaster-Recovery-Runbook
- Monitoring/Alerting (kein Prometheus/Grafana — Hetzner-Standard-Metriken reichen)
- Multi-Region/HA
- Rate-Limiting auf Login (Caddy hat es nicht; Single-User → niedriges Risiko)

## 3. Architekturentscheidungen

### 3.1 tsx in Production, NICHT tsc-build

Backend bleibt im Container `tsx watch`-frei (kein Hot-Reload-Overhead), aber nutzt `tsx` direkt zum Starten: `CMD ["tsx", "src/server/index.ts"]`. Vorteile:
- Kein Build-Step im Dockerfile für Backend-TS → einfacheres Image
- Konsistent mit dev (`pnpm dev` nutzt auch tsx)
- tsconfig bleibt `noEmit: true` ohne Build-Variante

Nachteil: ~200ms langsamerer Startup vs. vorkompiliertes JS. Für eine Single-User-App akzeptabel.

### 3.2 Multi-Stage Dockerfile

```
Stage 1 (ui-builder):    node:22-alpine → pnpm install (ui) → pnpm build → ui/dist
Stage 2 (deps):          node:22-alpine → pnpm install --prod (root, mit better-sqlite3)
Stage 3 (runtime):       node:22-alpine → copy deps + src + ui/dist + config
```

Final image enthält:
- `/app/node_modules/` (production-deps inkl. `tsx`)
- `/app/src/` (TS-source)
- `/app/public/` (UI-Build aus Stage 1)
- `/app/config/app.yaml`
- `/app/data/` (leer, gemountet als Volume)

`USER node` für non-root. `EXPOSE 3030`. `WORKDIR /app`.

### 3.3 better-sqlite3 native-binding

`better-sqlite3` braucht native Kompilierung. Im Builder-Stage muss Alpine bauen können: `apk add --no-cache python3 make g++` als build-deps. Im Runtime-Stage NUR die kompilierte .node-Datei kopieren → schlankes Image.

Alternative: prebuilt-Binary von npm direkt benutzen (better-sqlite3 hat prebuilt für linux-x64-musl). Wenn das verfügbar ist, sparen wir die Build-Tools komplett.

Praktischer Test im Container: erste Variante ohne build-tools probieren, fallback mit build-tools wenn nötig.

### 3.4 Statische UI über Hono

Hono serviert `/api/*` für Routen UND `/*` für statische Files aus `/app/public/`. Im Dev wird `ui/dist` nicht serviert (Vite handled das), im Container schon. `src/server/index.ts` muss in Phase 4 erweitert werden um:

```ts
import { serveStatic } from "@hono/node-server/serve-static";
// vor dem notFound-Handler:
app.use("/*", serveStatic({ root: "./public" }));
```

Das ersetzt den aktuellen `notFound`-Handler für Nicht-API-Pfade durch ein File-Serve mit Fallback auf `index.html` (für React-Router-DOM-clientseitige Routen):

```ts
app.use("/*", serveStatic({
  root: "./public",
  rewriteRequestPath: (path) => path,
}));
app.notFound((c) => c.html(/* index.html */ ...));
```

Pragmatisch: Hono's `serveStatic` mit Fallback auf `index.html` für SPA-Routes.

### 3.5 docker-compose mit Bind 127.0.0.1:8082

```yaml
ports:
  - "127.0.0.1:8082:3030"
```

Container-Port 3030 (intern, kein Konflikt mit `pnpm dev` auf der Box selbst), Host-Port 8082 (lokal-only, Caddy proxyt davor). Volume `reisekontor-data:/app/data` für SQLite-Persistenz.

`restart: unless-stopped`. `NODE_ENV=production`. `APP_CONFIG_PATH=/app/config/app.yaml`. `DATABASE_PATH=/app/data/reisekontor.db`. Secrets aus `.env`-File (`env_file: ../.env`).

### 3.6 Caddyfile.snippet im Repo

Wir checken einen Caddy-Snippet ein, den der User manuell ans Box-Caddyfile anhängt:

```caddy
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

Caddy automatisches TLS via Let's Encrypt (gleich wie finanz-app).

### 3.7 GitHub Actions

**`ci.yml`** läuft auf jedem Push + PR:
- Setup pnpm + node 22
- pnpm install
- pnpm test (Backend)
- pnpm typecheck + pnpm typecheck:ui
- pnpm lint:check + pnpm lint:ui
- pnpm build:ui

**`deploy.yml`** läuft nur manuell (`workflow_dispatch`):
- SSH zu Hetzner via `ssh-action`
- `cd /opt/reisekontor && git pull origin main && docker compose -f docker/docker-compose.yaml up -d --build`

Secrets im GitHub-Repo:
- `HETZNER_SSH_KEY` (private key)
- `HETZNER_HOST` (IP oder DNS)
- `HETZNER_USER` (z.B. `deploy`)

Der `deploy`-User auf der Box muss `docker`-Group-Mitglied sein (`usermod -aG docker deploy`).

### 3.8 GitHub-Repo anlegen + Initial Push

`gh repo create reisekontor --private --source . --push --description "Reisekontor — persönliche Reisekosten- und Homeoffice-Erfassung"`

Branch `main` ist remote = local. Alle 90+ Commits + Tags werden gepusht.

### 3.9 Initial-Setup auf der Hetzner-Box (User-Verantwortung)

Schritte im Runbook (`docs/runbook.md`):

1. SSH zur Box
2. `sudo mkdir /opt/reisekontor && sudo chown $USER:$USER /opt/reisekontor`
3. `cd /opt/reisekontor && git clone git@github.com:<owner>/reisekontor.git .`
4. `.env` erstellen mit:
   - `APP_PASSWORD_HASH=<argon2-hash>` (von `pnpm hash:password <plain>` lokal)
   - `SESSION_SECRET=<32-byte hex>` (von `openssl rand -hex 32`)
   - `NODE_ENV=production`
5. `docker compose -f docker/docker-compose.yaml up -d --build`
6. Caddyfile-Eintrag anhängen + `sudo systemctl reload caddy`
7. DNS A-Record für `reisen.jans-Claude-Apps.de` → Hetzner-IP setzen (im DNS-Provider)
8. Warten bis Caddy TLS-Zertifikat geholt hat (Sekunden bis 2 Minuten)
9. Browser: `https://reisen.jans-Claude-Apps.de` → Login

### 3.10 KEIN Backup, aber Volume + Daten-Klarheit

User hat ohne-Backup explizit gewählt. Hinweise im Runbook:
- SQLite-DB liegt im Docker-Volume `reisekontor-data` (persistent über Container-Recreate)
- `docker volume inspect reisekontor-data` → physikalischer Pfad
- Manueller Snapshot jederzeit möglich: `docker run --rm -v reisekontor-data:/data alpine tar czf - /data > backup-$(date +%F).tar.gz`
- Datenverlust-Risiko: Hetzner-Hardware-Failure → Daten weg. Akzeptiert.

### 3.11 Versionsbump 0.9.0

Großer Outside-Effects-Schritt → Minor. (1.0.0 reserviert für „läuft 2+ Wochen produktiv ohne Issue".)

## 4. File-Struktur

```
reisekontor/
├── .dockerignore                          # NEU
├── docker/                                # NEU
│   ├── Dockerfile
│   ├── docker-compose.yaml
│   └── Caddyfile.snippet
├── .github/                               # NEU
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docs/
│   └── runbook.md                         # NEU
├── src/server/index.ts                    # MODIFY — serveStatic + SPA-Fallback
├── package.json                           # MODIFY — Version 0.9.0
├── ui/package.json                        # MODIFY — Version 0.9.0
└── CHANGELOG.md                           # MODIFY
```

## 5. Tests

Backend bleibt bei 173 — keine neuen Backend-Tests, weil Deploy keine Logik ist. Vitest-Tests deckten die Integration-Pfade ab. Smoke ist:
- Lokaler `docker compose up --build` → `curl http://localhost:8082/api/health` ohne Cookie → 401 (Server lebt)
- Login per curl → 200 + Cookie
- Health mit Cookie → 200

Browser-Smoke nach Deploy (auf der Box): Login funktioniert + Export-Download durch HTTPS.

## 6. Abschluss-Kriterien

- [ ] `docker compose -f docker/docker-compose.yaml up --build` lokal funktioniert
- [ ] `curl http://localhost:8082/api/health` ohne Cookie → 401 mit JSON-Body
- [ ] Login per curl + Health mit Cookie → 200 mit `version: "0.9.0"`
- [ ] UI über `http://localhost:8082` erreichbar (statisch ausgeliefert)
- [ ] GitHub-Repo angelegt + alle 90+ Commits gepusht
- [ ] CI workflow läuft grün auf GitHub
- [ ] Runbook + Caddy-Snippet committed
- [ ] CHANGELOG `[0.9.0]`

Deploy-on-Hetzner ist User-Schritt — wir liefern alles was er dafür braucht.

## 7. Nächste Phase

Phase 5 (optional): Backup-Strategie wenn die App ein paar Wochen lief und produktive Daten drin sind. Plus eventuell Phase 2-Forschritte (LLM-basiertes Erklärungs-Layer für die Steuererklärung — aus Memory `2_0_strategy`, aber das ist statusbericht-agent-Strategie, nicht für reisekontor zwingend).
