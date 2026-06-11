import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  exp: number; // epoch seconds
}

export function signSession(payload: SessionPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = hmac(payloadB64, secret);
  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expectedSig, "base64url");
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { exp?: unknown }).exp !== "number"
  ) {
    return null;
  }
  const typed = payload as SessionPayload;
  const nowSec = Math.floor(Date.now() / 1000);
  if (typed.exp < nowSec) return null;
  return typed;
}

function hmac(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}
