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
let authCookie: string;

beforeAll(async () => {
  db = createDb({ databasePath: ":memory:" });
  app = createServer({
    config: fixtureConfig,
    db,
    passwordHash: await hashPassword(PLAIN),
    sessionSecret: SECRET,
    isProduction: false,
  });
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PLAIN }),
  });
  authCookie = /rk_session=([^;]+)/.exec(loginRes.headers.get("set-cookie") ?? "")?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/holidays/sync", () => {
  it("POST mit year=2026 → 200 mit created>=9", async () => {
    const res = await authedReq("/api/holidays/sync?year=2026", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      year: number;
      bundesland: string;
      created: number;
      skipped: Array<unknown>;
    };
    expect(body.year).toBe(2026);
    expect(body.bundesland).toBe("NI");
    expect(body.created).toBeGreaterThanOrEqual(9);
  });

  it("POST ohne year → 400", async () => {
    const res = await authedReq("/api/holidays/sync", { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("nach Sync sind die Feiertage in /api/days sichtbar", async () => {
    await authedReq("/api/holidays/sync?year=2026", { method: "POST" });
    const days = await authedReq("/api/days?year=2026");
    const list = (await days.json()) as Array<{ type: string }>;
    expect(list.filter((d) => d.type === "feiertag").length).toBeGreaterThanOrEqual(9);
  });
});
