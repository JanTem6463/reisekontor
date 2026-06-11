import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { verifyPassword } from "../../auth/password.ts";
import { signSession } from "../../auth/session.ts";
import { SESSION_COOKIE_NAME } from "../middleware/auth.ts";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 Tage

export interface AuthRouteDeps {
  passwordHash: string;
  sessionSecret: string;
  isProduction: boolean;
}

const LoginBody = z.object({ password: z.string().min(1) });

export function createAuthRouter(deps: AuthRouteDeps): Hono {
  const app = new Hono();

  app.post("/login", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = LoginBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body" }, 400);
    }
    const ok = await verifyPassword(deps.passwordHash, parsed.data.password);
    if (!ok) {
      return c.json({ error: "invalid_password" }, 401);
    }
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const token = signSession({ exp }, deps.sessionSecret);
    setCookie(c, SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: deps.isProduction,
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    return c.json({ ok: true });
  });

  app.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  return app;
}
