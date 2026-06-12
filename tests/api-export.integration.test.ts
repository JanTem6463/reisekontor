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
  ratesForYear: (year) => {
    if (year !== 2026) throw new Error(`Keine Sätze für ${year}`);
    return {
      kleineCent: 1400,
      grosseCent: 2800,
      kuerzFruehstueckCent: 560,
      kuerzHauptCent: 1120,
      homeofficeProTagCent: 600,
      homeofficeMaxCent: 126000,
    };
  },
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

describe("/api/export/reisekosten", () => {
  it("GET ?year=2026&format=csv → 200 + CSV-Body", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("reisekosten-2026.csv");
    const buf = Buffer.from(await res.arrayBuffer());
    // UTF-8-BOM (EF BB BF) am Anfang, sonst öffnet Excel-DE die Datei falsch
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    expect(buf.toString("utf8")).toContain("Datum;Tagestyp");
  });

  it("GET ?year=2026&format=xlsx → 200 + XLSX-Body", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("GET ?year=2026&format=pdf → 200 + PDF-Body", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("GET ohne format → 400 invalid_format", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_format" });
  });

  it("GET ohne year → 400 invalid_query", async () => {
    const res = await authedReq("/api/export/reisekosten?format=csv");
    expect(res.status).toBe(400);
  });

  it("GET mit unbekanntem format → 400", async () => {
    const res = await authedReq("/api/export/reisekosten?year=2026&format=docx");
    expect(res.status).toBe(400);
  });
});

describe("/api/export/homeoffice", () => {
  it("GET ?year=2026&format=csv → 200 + CSV-Body", async () => {
    const res = await authedReq("/api/export/homeoffice?year=2026&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("GET ?year=2026&format=xlsx → 200 + XLSX-Body", async () => {
    const res = await authedReq("/api/export/homeoffice?year=2026&format=xlsx");
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("GET ?year=2026&format=pdf → 200 + PDF-Body", async () => {
    const res = await authedReq("/api/export/homeoffice?year=2026&format=pdf");
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("/api/export/steuer", () => {
  it("GET ?year=2026&format=csv → 200 + CSV-Body mit Steuer-Header", async () => {
    const res = await authedReq("/api/export/steuer?year=2026&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("steuer-2026.csv");
    const text = Buffer.from(await res.arrayBuffer()).toString("utf8");
    expect(text).toContain("Steuer-Übersicht 2026");
    expect(text).toContain("Homeoffice Tage");
  });

  it("GET ?year=2026&format=xlsx → 200 + XLSX-Body", async () => {
    const res = await authedReq("/api/export/steuer?year=2026&format=xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("GET ?year=2026&format=pdf → 200 + PDF-Body", async () => {
    const res = await authedReq("/api/export/steuer?year=2026&format=pdf");
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
