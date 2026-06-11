import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { type SessionPayload, verifySession } from "../../auth/session.ts";

export const SESSION_COOKIE_NAME = "rk_session";

export interface AuthEnv {
  Variables: { session: SessionPayload };
}

export function authMiddleware(sessionSecret: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const cookie = getCookie(c, SESSION_COOKIE_NAME);
    if (!cookie) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const session = verifySession(cookie, sessionSecret);
    if (!session) {
      return c.json({ error: "unauthorized" }, 401);
    }
    c.set("session", session);
    await next();
  });
}
