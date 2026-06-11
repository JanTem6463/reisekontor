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

describe("/api/trips", () => {
  it("POST gültige Reise → 201, GET listet", async () => {
    const post = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        uebernachtung: true,
      }),
    });
    expect(post.status).toBe(201);
    const created = (await post.json()) as { trip: { id: number }; days: Array<unknown> };
    expect(created.days).toHaveLength(3);

    const get = await authedReq("/api/trips?year=2026");
    expect(get.status).toBe(200);
    const list = (await get.json()) as Array<unknown>;
    expect(list).toHaveLength(1);
  });

  it("POST eintägig + Übernachtung → 400 invalid_trip_dates", async () => {
    const res = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        uebernachtung: true,
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_trip_dates" });
  });

  it("POST mit Date-Konflikt → 409", async () => {
    // 1. Trip
    await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        uebernachtung: true,
      }),
    });
    // 2. Trip mit überlappendem Datum
    const res = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-06-02",
        endDate: "2026-06-04",
        uebernachtung: true,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("GET ohne year → 400", async () => {
    const res = await authedReq("/api/trips");
    expect(res.status).toBe(400);
  });

  it("GET /:id nicht existierend → 404", async () => {
    const res = await authedReq("/api/trips/9999");
    expect(res.status).toBe(404);
  });

  it("DELETE nicht existierend → 404", async () => {
    const res = await authedReq("/api/trips/9999", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("PUT auf existierender Trip → Hart-Reset", async () => {
    const create = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-07-01",
        endDate: "2026-07-02",
        uebernachtung: true,
      }),
    });
    const { trip } = (await create.json()) as { trip: { id: number } };

    const update = await authedReq(`/api/trips/${trip.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        uebernachtung: true,
      }),
    });
    expect(update.status).toBe(200);
    const updated = (await update.json()) as { days: Array<unknown> };
    expect(updated.days).toHaveLength(5);
  });
});
