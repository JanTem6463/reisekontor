import { randomUUID } from "node:crypto";
import { SignJWT, exportPKCS8, exportSPKI, generateKeyPair, importPKCS8 } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { HubSsoVerifier } from "../src/auth/hub-sso.ts";
import { createDb } from "../src/db/client.ts";
import { createServer } from "../src/server/index.ts";
import type { AppConfig } from "../src/config/index.ts";

async function signHubToken(privatePem: string, overrides: Partial<{
  aud: string; iss: string; jti: string; ttlSeconds: number;
}> = {}): Promise<string> {
  const key = await importPKCS8(privatePem, "EdDSA");
  return new SignJWT({})
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(overrides.iss ?? "hub.jans-claude-apps.de")
    .setAudience(overrides.aud ?? "reisen")
    .setSubject("jan")
    .setJti(overrides.jti ?? randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${overrides.ttlSeconds ?? 60}s`)
    .sign(key);
}

const minimalConfig: AppConfig = {
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
  feiertage: { bundesland: "NW" },
  personal: undefined,
};

describe("HubSsoVerifier + /sso route", () => {
  let privatePem: string;
  let publicPem: string;

  beforeAll(async () => {
    const kp = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    privatePem = await exportPKCS8(kp.privateKey);
    publicPem = await exportSPKI(kp.publicKey);
  });

  function newServer() {
    const db = createDb({ databasePath: ":memory:" });
    return createServer({
      config: minimalConfig,
      db,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$abcdefghijklmnopqrstuv$abcdefghijklmnopqrstuvwxyz1234567890abcdefg",
      sessionSecret: "s".repeat(64),
      isProduction: false,
      hubSso: {
        hubPublicKeyPem: publicPem,
        hubIssuer: "hub.jans-claude-apps.de",
        audience: "reisen",
      },
    });
  }

  it("HubSsoVerifier accepts valid token", async () => {
    const v = new HubSsoVerifier({
      hubPublicKeyPem: publicPem,
      hubIssuer: "hub.jans-claude-apps.de",
      audience: "reisen",
    });
    const token = await signHubToken(privatePem);
    const payload = await v.verify(token);
    expect(payload.sub).toBe("jan");
  });

  it("HubSsoVerifier rejects wrong audience", async () => {
    const v = new HubSsoVerifier({
      hubPublicKeyPem: publicPem,
      hubIssuer: "hub.jans-claude-apps.de",
      audience: "reisen",
    });
    const token = await signHubToken(privatePem, { aud: "kochen" });
    await expect(v.verify(token)).rejects.toThrow();
  });

  it("HubSsoVerifier rejects replay", async () => {
    const v = new HubSsoVerifier({
      hubPublicKeyPem: publicPem,
      hubIssuer: "hub.jans-claude-apps.de",
      audience: "reisen",
    });
    const jti = randomUUID();
    const token = await signHubToken(privatePem, { jti });
    await v.verify(token);
    await expect(v.verify(token)).rejects.toThrow(/replay/);
  });

  it("GET /sso with valid token → 302 + cookie", async () => {
    const server = newServer();
    const token = await signHubToken(privatePem);
    const res = await server.request(`/sso?token=${token}&next=/`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("rk_session=");
    expect(cookie).toContain("HttpOnly");
  });

  it("GET /sso without token → 400", async () => {
    const server = newServer();
    const res = await server.request("/sso");
    expect(res.status).toBe(400);
  });

  it("GET /sso with invalid token → 401", async () => {
    const server = newServer();
    const res = await server.request("/sso?token=notatoken");
    expect(res.status).toBe(401);
  });

  it("GET /sso rejects protocol-relative next → falls back to /", async () => {
    const server = newServer();
    const token = await signHubToken(privatePem);
    const res = await server.request(`/sso?token=${token}&next=//evil.example`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });
});
