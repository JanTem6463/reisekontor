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

describe("/api/checks", () => {
  it("leeres Jahr → []", async () => {
    const res = await authedReq("/api/checks?year=2026");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("nach PUT homeoffice → HO_KONFLIKT_ENTFERNUNG", async () => {
    await authedReq("/api/days/2026-03-15", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "homeoffice" }),
    });
    const res = await authedReq("/api/checks?year=2026");
    const hinweise = (await res.json()) as Array<{ code: string; date: string }>;
    expect(hinweise.some((h) => h.code === "HO_KONFLIKT_ENTFERNUNG")).toBe(true);
  });

  it("ohne year → 400", async () => {
    const res = await authedReq("/api/checks");
    expect(res.status).toBe(400);
  });
});
