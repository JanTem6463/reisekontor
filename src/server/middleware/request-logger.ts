import { createMiddleware } from "hono/factory";
import { logger as appLogger } from "../../shared/logger.ts";

export function requestLogger() {
  return createMiddleware(async (c, next) => {
    const start = Date.now();
    await next();
    const duration_ms = Date.now() - start;
    appLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration_ms,
      },
      "request",
    );
  });
}
