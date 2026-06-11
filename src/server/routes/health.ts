import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const START_TIME_MS = Date.now();

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, "..", "..", "..", "package.json");
const VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

export function createHealthRouter(): Hono {
  const app = new Hono();
  app.get("/", (c) => {
    return c.json({
      ok: true,
      version: VERSION,
      uptime_seconds: Math.floor((Date.now() - START_TIME_MS) / 1000),
    });
  });
  return app;
}
