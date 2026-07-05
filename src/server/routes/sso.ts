import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { HubSsoVerifier } from "../../auth/hub-sso.ts";
import { signSession } from "../../auth/session.ts";
import { SESSION_COOKIE_NAME } from "../middleware/auth.ts";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 Tage (analog /api/auth/login)

export interface SsoRouteDeps {
  verifier: HubSsoVerifier;
  sessionSecret: string;
  isProduction: boolean;
}

/**
 * Baut die /sso-Route, die einen vom Hub signierten Ed25519-JWT annimmt,
 * verifiziert und daraufhin die reguläre Reisekontor-Session-Cookie setzt.
 * Redirected anschließend zu `next` (whitelist: nur relative Pfade).
 */
export function createSsoRouter(deps: SsoRouteDeps): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const token = c.req.query("token");
    const next = c.req.query("next") ?? "/";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (!token) return c.json({ error: "missing_token" }, 400);

    try {
      await deps.verifier.verify(token);
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const sessionToken = signSession({ exp }, deps.sessionSecret);
    setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: deps.isProduction,
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    return c.redirect(safeNext, 302);
  });

  return app;
}
