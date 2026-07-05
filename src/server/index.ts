import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { type AppConfig, loadConfig } from "../config/index.ts";
import { type Db, createDb } from "../db/client.ts";
import { logger as appLogger } from "../shared/logger.ts";
import { HubSsoVerifier } from "../auth/hub-sso.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { createAuthRouter } from "./routes/auth.ts";
import { createChecksRouter } from "./routes/checks.ts";
import { createDaysRouter } from "./routes/days.ts";
import { createExportRouter } from "./routes/export.ts";
import { createHealthRouter } from "./routes/health.ts";
import { createHolidaysRouter } from "./routes/holidays.ts";
import { createSettingsRouter } from "./routes/settings.ts";
import { createSsoRouter } from "./routes/sso.ts";
import { createSummaryRouter } from "./routes/summary.ts";
import { createTripsRouter } from "./routes/trips.ts";

export interface HubSsoDeps {
  hubPublicKeyPem: string;
  hubIssuer: string;
  audience: string;
}

export interface ServerDeps {
  config: AppConfig;
  db: Db;
  passwordHash: string;
  sessionSecret: string;
  isProduction: boolean;
  hubSso?: HubSsoDeps | undefined;
}

export function createServer(deps: ServerDeps): Hono {
  const app = new Hono();

  // Request-Logger zuerst, damit auch 401/404/500 geloggt werden
  app.use("*", requestLogger());

  // /api/auth: kein Auth-Middleware
  app.route(
    "/api/auth",
    createAuthRouter({
      passwordHash: deps.passwordHash,
      sessionSecret: deps.sessionSecret,
      isProduction: deps.isProduction,
    }),
  );

  // /sso: Ed25519-Bridge vom jans-hub (kein Auth-Middleware, kein /api-Prefix
  // damit die HubSsoConfig 1:1 zum Spec-Layout passt). Nur registriert wenn
  // HUB_PUBLIC_KEY konfiguriert ist.
  if (deps.hubSso) {
    const verifier = new HubSsoVerifier({
      hubPublicKeyPem: deps.hubSso.hubPublicKeyPem,
      hubIssuer: deps.hubSso.hubIssuer,
      audience: deps.hubSso.audience,
    });
    app.route(
      "/sso",
      createSsoRouter({
        verifier,
        sessionSecret: deps.sessionSecret,
        isProduction: deps.isProduction,
      }),
    );
  }

  // Alles andere unter /api/* erfordert Auth
  app.use("/api/*", authMiddleware(deps.sessionSecret));

  app.route("/api/health", createHealthRouter());
  app.route("/api/days", createDaysRouter({ db: deps.db }));
  app.route("/api/trips", createTripsRouter({ db: deps.db }));
  app.route("/api/summary", createSummaryRouter({ db: deps.db, config: deps.config }));
  app.route("/api/holidays", createHolidaysRouter({ db: deps.db, config: deps.config }));
  app.route("/api/checks", createChecksRouter({ db: deps.db }));
  app.route("/api/settings", createSettingsRouter({ db: deps.db, config: deps.config }));
  app.route("/api/export", createExportRouter({ db: deps.db, config: deps.config }));

  // Statische UI-Dateien (Production) — nur wenn ./public/index.html existiert
  const publicDir = process.env.STATIC_DIR ?? "./public";
  let indexHtml: string | null = null;
  try {
    indexHtml = readFileSync(join(publicDir, "index.html"), "utf8");
  } catch {
    // dev mode: keine statische UI im Server
  }

  if (indexHtml !== null) {
    app.use("/*", serveStatic({ root: publicDir }));
    // SPA-Fallback: alles, was nicht /api/* ist und nicht statisch gefunden wurde → index.html
    app.notFound((c) => {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.html(indexHtml ?? "");
    });
  } else {
    app.notFound((c) =>
      c.json({ error: "not_found", hint: "UI über Vite-Dev-Server (Port 5174)" }, 404),
    );
  }

  // Zentraler Error-Handler — keine Stack-Traces nach außen
  app.onError((err, c) => {
    appLogger.error({ err: err.message, path: c.req.path }, "request failed");
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig(process.env.APP_CONFIG_PATH ?? "config/app.yaml");
  const databasePath = process.env.DATABASE_PATH ?? "./data/reisekontor.db";
  const db = createDb({ databasePath });

  const passwordHash = process.env.APP_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!passwordHash || !sessionSecret) {
    appLogger.fatal(
      "APP_PASSWORD_HASH und SESSION_SECRET müssen gesetzt sein. Siehe .env.example.",
    );
    process.exit(1);
  }
  if (sessionSecret.length < 64) {
    appLogger.fatal(
      `SESSION_SECRET muss mindestens 64 Zeichen lang sein (32 bytes hex). Aktuell ${sessionSecret.length}.`,
    );
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === "production";
  const port = Number.parseInt(process.env.PORT ?? "3030", 10);

  const hubPublicKey = process.env.HUB_PUBLIC_KEY;
  const hubSso = hubPublicKey
    ? {
        hubPublicKeyPem: hubPublicKey,
        hubIssuer: process.env.HUB_ISSUER ?? "hub.jans-claude-apps.de",
        audience: process.env.HUB_AUDIENCE ?? "reisen",
      }
    : undefined;
  if (hubSso) {
    appLogger.info({ audience: hubSso.audience }, "hub sso enabled");
  }

  const app = createServer({ config, db, passwordHash, sessionSecret, isProduction, hubSso });

  serve({ fetch: app.fetch, port }, (info) => {
    appLogger.info({ port: info.port }, "reisekontor server gestartet");
  });
}

// Detect if this file is the direct entrypoint vs being imported by tests
const isDirectRun = (() => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  // Compare normalized paths (Windows backslashes → forward slashes; strip file:// prefix)
  const argvNormalized = argv1.replace(/\\/g, "/");
  const metaNormalized = import.meta.url.replace(/^file:\/\//, "").replace(/^\//, "");
  return argvNormalized === metaNormalized || argvNormalized.endsWith(metaNormalized);
})();

if (isDirectRun) {
  main().catch((err) => {
    appLogger.fatal({ err: err instanceof Error ? err.message : String(err) }, "startup failed");
    process.exit(1);
  });
}
