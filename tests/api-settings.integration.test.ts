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

describe("/api/settings", () => {
  it("GET ohne DB-Override → Config-Defaults", async () => {
    const res = await authedReq("/api/settings");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bundesland: string; standardwoche: { mo: boolean } };
    expect(body.bundesland).toBe("NI");
    expect(body.standardwoche.mo).toBe(true);
  });

  it("PUT bundesland → 200, GET zeigt neuen Wert", async () => {
    const put = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundesland: "BY" }),
    });
    expect(put.status).toBe(200);
    const get = await authedReq("/api/settings");
    const body = (await get.json()) as { bundesland: string };
    expect(body.bundesland).toBe("BY");
  });

  it("PUT mit invalid bundesland (XX) → 400 invalid_bundesland_in_settings", async () => {
    const res = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundesland: "XX" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_bundesland_in_settings" });
  });

  it("PUT standardwoche → 200, GET zeigt neuen Wert", async () => {
    const sw = { mo: false, di: false, mi: false, do: false, fr: false, sa: true, so: true };
    const put = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardwoche: sw }),
    });
    expect(put.status).toBe(200);
    const get = await authedReq("/api/settings");
    const body = (await get.json()) as { standardwoche: typeof sw };
    expect(body.standardwoche).toEqual(sw);
  });

  it("PUT mit invalid body (kein Objekt) → 400 invalid_body", async () => {
    const res = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body" });
  });
});
