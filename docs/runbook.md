# Reisekontor — Runbook

## Erstmaliger Setup auf der Hetzner-Box

1. SSH zur Box als deploy-User.
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
4. `.env` erstellen. Werte vorher lokal erzeugen:
   - `APP_PASSWORD_HASH`: lokal `pnpm hash:password <plain>` ausführen, Hash kopieren.
   - `SESSION_SECRET`: lokal `openssl rand -hex 32` (oder `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - Auf der Box: `nano .env` und Werte eintragen (siehe `.env.example`).
   - **Wichtig: argon2-Hash mit `$`-Zeichen single-quoten in `.env`** (Docker Compose interpoliert sonst).
5. Container starten:
   ```bash
   docker compose -f docker/docker-compose.yaml up -d --build
   ```
6. Caddyfile-Eintrag anhängen:
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```
   Inhalt aus `docker/Caddyfile.snippet` ans Ende des Caddyfiles anhängen.
7. Caddy reloaden:
   ```bash
   sudo systemctl reload caddy
   ```
8. DNS-Record im Hetzner-Console / DNS-Provider setzen:
   - Typ: A
   - Name: reisen.jans-Claude-Apps.de
   - Wert: <Hetzner-IP>
9. Warten bis Caddy TLS-Zertifikat geholt hat (1-2 Min). Logs: `sudo journalctl -u caddy -f`.
10. Browser: `https://reisen.jans-Claude-Apps.de` → Login mit dem Passwort, das in Schritt 4 in einen Hash umgewandelt wurde.

## GitHub Repo Secrets

Im GitHub-Repo unter Settings → Secrets and variables → Actions:
- `HETZNER_HOST` — IP oder Hostname der Box.
- `HETZNER_USER` — Username (z.B. `deploy`).
- `HETZNER_SSH_KEY` — Private-Key für SSH (muss als Public-Key in `~/.ssh/authorized_keys` auf der Box stehen).

Der `deploy`-User muss Mitglied der `docker`-Group sein:
```bash
sudo usermod -aG docker deploy
```
Danach neu einloggen, damit die Group-Membership wirkt.

## Deploy-Loop

Nach Push auf `main`:
1. CI läuft automatisch (lint + tests + ui-build).
2. Wenn CI grün → manuell triggern:
   ```bash
   gh workflow run deploy.yml
   ```
3. Status:
   ```bash
   gh run list --workflow=deploy.yml
   gh run watch
   ```

## Rollback

Auf der Box:
```bash
cd /opt/reisekontor
git log --oneline -10                # finde gewünschten Commit
git reset --hard <commit-sha>
docker compose -f docker/docker-compose.yaml up -d --build
```

## Logs ansehen

```bash
docker compose -f docker/docker-compose.yaml logs -f reisekontor
```

## App stoppen / starten

```bash
docker compose -f docker/docker-compose.yaml down
docker compose -f docker/docker-compose.yaml up -d
```

## Passwort ändern

1. Lokal: `pnpm hash:password <neues_passwort>` → Hash kopieren.
2. Box: `nano /opt/reisekontor/.env` → APP_PASSWORD_HASH ersetzen (single-quoten!).
3. Container neu starten:
   ```bash
   docker compose -f docker/docker-compose.yaml restart reisekontor
   ```

## Manueller Snapshot (kein automatisches Backup)

```bash
cd /opt/reisekontor
docker run --rm \
  -v reisekontor-data:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/reisekontor-backup-$(date +%F).tar.gz /data
```

## Restore aus Snapshot

```bash
cd /opt/reisekontor
docker compose -f docker/docker-compose.yaml down
docker volume rm reisekontor_reisekontor-data   # Volume-Name mit compose-Prefix
docker volume create reisekontor_reisekontor-data
docker run --rm \
  -v reisekontor_reisekontor-data:/data \
  -v $(pwd):/backup \
  alpine \
  sh -c "cd / && tar xzf /backup/reisekontor-backup-YYYY-MM-DD.tar.gz"
docker compose -f docker/docker-compose.yaml up -d
```

Hinweis: docker compose prefixiert Volume-Namen mit dem Projekt-Verzeichnis. Falls der tatsächliche Name abweicht: `docker volume ls | grep reisekontor` listet alle.

## Disk-Space-Check

```bash
docker system df
docker images --filter "dangling=true" -q | xargs -r docker rmi  # alte Images aufräumen
```

## Reisekontor-spezifische Health-Checks

- HTTP 401 von `https://reisen.jans-Claude-Apps.de/api/health` ohne Cookie → Server lebt.
- HTTP 200 von `/api/health` mit gültigem Cookie → Server hat DB-Zugriff (kein DB-Lock).
- Login per Browser → vollständiger Stack OK.
