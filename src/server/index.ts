import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { type AppConfig, loadConfig } from "../config/index.ts";
import { type Db, createDb } from "../db/client.ts";
import { logger as appLogger } from "../shared/logger.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { createAuthRouter } from "./routes/auth.ts";
import { createDaysRouter } from "./routes/days.ts";
import { createHealthRouter } from "./routes/health.ts";

export interface ServerDeps {
  config: AppConfig;
  db: Db;
  passwordHash: string;
  sessionSecret: string;
  isProduction: boolean;
}

export function createServer(deps: ServerDeps): Hono {
  const app = new Hono();

  // /api/auth: kein Auth-Middleware
  app.route(
    "/api/auth",
    createAuthRouter({
      passwordHash: deps.passwordHash,
      sessionSecret: deps.sessionSecret,
      isProduction: deps.isProduction,
    }),
  );

  // Alles andere unter /api/* erfordert Auth
  app.use("/api/*", authMiddleware(deps.sessionSecret));

  app.route("/api/health", createHealthRouter());
  app.route("/api/days", createDaysRouter({ db: deps.db }));

  // 404 für alles andere — UI kommt in Phase 2
  app.notFound((c) => c.json({ error: "not_found", hint: "UI kommt in Phase 2" }, 404));

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

  const app = createServer({ config, db, passwordHash, sessionSecret, isProduction });

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
