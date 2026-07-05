import { type CryptoKey as JoseKey, importSPKI, jwtVerify } from "jose";

export interface HubSsoPayload {
  sub: string;
  jti: string;
  exp: number;
}

export interface HubSsoConfig {
  hubPublicKeyPem: string;
  hubIssuer: string;
  audience: string;
}

const REPLAY_TTL_SECONDS = 300;

export class HubSsoVerifier {
  private keyPromise: Promise<JoseKey>;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly replayCache = new Map<string, number>();

  constructor(cfg: HubSsoConfig) {
    this.keyPromise = importSPKI(cfg.hubPublicKeyPem, "EdDSA");
    this.issuer = cfg.hubIssuer;
    this.audience = cfg.audience;
  }

  async verify(token: string): Promise<HubSsoPayload> {
    const key: JoseKey = await this.keyPromise;
    const { payload } = await jwtVerify(token, key, {
      issuer: this.issuer,
      audience: this.audience,
    });
    const jti = typeof payload.jti === "string" ? payload.jti : "";
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    if (!jti || !exp || !sub) throw new Error("hub_token_incomplete");
    this.gcReplayCache();
    if (this.replayCache.has(jti)) throw new Error("hub_token_replay");
    this.replayCache.set(jti, exp);
    return { sub, jti, exp };
  }

  private gcReplayCache(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, exp] of this.replayCache) {
      if (exp < now - REPLAY_TTL_SECONDS) this.replayCache.delete(key);
    }
  }
}
