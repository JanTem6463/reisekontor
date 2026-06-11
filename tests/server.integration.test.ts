import type { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password.ts";
import type { AppConfig } from "../src/config/index.ts";
import { type Db, createDb } from "../src/db/client.ts";
import { createServer } from "../src/server/index.ts";

const SECRET = "0".repeat(64);
const PLAIN = "TestPassword!23";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400,
        grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560,
        kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600,
        homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: () => ({
    kleineCent: 1400,
    grosseCent: 2800,
    kuerzFruehstueckCent: 560,
    kuerzHauptCent: 1120,
    homeofficeProTagCent: 600,
    homeofficeMaxCent: 126000,
  }),
};

let app: Hono;
let db: Db;
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PLAIN);
  db = createDb({ databasePath: ":memory:" });
  app = createServer({
    config: fixtureConfig,
    db,
    passwordHash,
    sessionSecret: SECRET,
    isProduction: false,
  });
});

function extractCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = /rk_session=([^;]+)/.exec(setCookie);
  return match?.[1] ?? null;
}

describe("Server Integration — Login → Health → Logout", () => {
  it("GET /api/health ohne Cookie → 401", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("POST /api/auth/login mit falschem Passwort → 401", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_password" });
  });

  it("POST /api/auth/login mit fehlendem Body → 400", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("Login → Health → Logout end-to-end", async () => {
    // 1. Login
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: PLAIN }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = extractCookie(loginRes.headers.get("set-cookie"));
    expect(cookie).not.toBeNull();

    // 2. Health mit Cookie
    const healthRes = await app.request("/api/health", {
      headers: { Cookie: `rk_session=${cookie}` },
    });
    expect(healthRes.status).toBe(200);
    const healthBody = (await healthRes.json()) as {
      ok: boolean;
      version: string;
      uptime_seconds: number;
    };
    expect(healthBody.ok).toBe(true);
    expect(healthBody.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof healthBody.uptime_seconds).toBe("number");

    // 3. Logout
    const logoutRes = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: `rk_session=${cookie}` },
    });
    expect(logoutRes.status).toBe(200);
    const clearedCookie = logoutRes.headers.get("set-cookie");
    expect(clearedCookie).toMatch(/rk_session=;/);
    expect(clearedCookie).toMatch(/Max-Age=0/);
  });

  it("404 für nicht-API-Pfade", async () => {
    const res = await app.request("/some/random/path");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; hint: string };
    expect(body.error).toBe("not_found");
    expect(body.hint).toContain("Phase 2");
  });
});
