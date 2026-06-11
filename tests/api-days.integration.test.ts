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
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  authCookie = /rk_session=([^;]+)/.exec(setCookie)?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/days", () => {
  it("GET ohne year → 400", async () => {
    const res = await authedReq("/api/days");
    expect(res.status).toBe(400);
  });

  it("GET leer → []", async () => {
    const res = await authedReq("/api/days?year=2026");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("PUT homeoffice → 200, GET zeigt 1", async () => {
    const put = await authedReq("/api/days/2026-03-15", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "homeoffice" }),
    });
    expect(put.status).toBe(200);
    const get = await authedReq("/api/days?year=2026");
    const list = (await get.json()) as Array<{ date: string; type: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.type).toBe("homeoffice");
  });

  it("PUT mit reise_anreise (kein existing) → 400 reise_type_via_trips", async () => {
    const res = await authedReq("/api/days/2026-04-01", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reise_anreise" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "reise_type_via_trips" });
  });

  it("PUT mit invalid type → 400 invalid_body", async () => {
    const res = await authedReq("/api/days/2026-04-01", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "unknown" }),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE existing → 200, danach GET zeigt 0", async () => {
    const del = await authedReq("/api/days/2026-03-15", { method: "DELETE" });
    expect(del.status).toBe(200);
    const list = (await (await authedReq("/api/days?year=2026")).json()) as Array<unknown>;
    expect(list).toHaveLength(0);
  });

  it("DELETE nicht existierend → 404", async () => {
    const res = await authedReq("/api/days/2026-12-31", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
