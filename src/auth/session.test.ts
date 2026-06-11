import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session.ts";

const SECRET = "a".repeat(64);
const FUTURE_EXP = 9_999_999_999; // Jahr 2286, weit in Zukunft

describe("signSession + verifySession", () => {
  it("round-trip liefert den Payload zurück", () => {
    const token = signSession({ exp: FUTURE_EXP }, SECRET);
    const payload = verifySession(token, SECRET);
    expect(payload).toEqual({ exp: FUTURE_EXP });
  });

  it("liefert null bei abgelaufenem Token", () => {
    const token = signSession({ exp: 1 }, SECRET); // 1970
    expect(verifySession(token, SECRET)).toBeNull();
  });

  it("liefert null bei falscher Signatur (Secret-Mismatch)", () => {
    const token = signSession({ exp: FUTURE_EXP }, SECRET);
    expect(verifySession(token, "b".repeat(64))).toBeNull();
  });

  it("liefert null bei manipuliertem Payload", () => {
    const token = signSession({ exp: FUTURE_EXP }, SECRET);
    const [payload, sig] = token.split(".");
    if (!payload || !sig) throw new Error("token format");
    // Payload kippen: setze exp auf 0
    const manipulated = `${Buffer.from('{"exp":0}').toString("base64url")}.${sig}`;
    expect(verifySession(manipulated, SECRET)).toBeNull();
  });

  it("liefert null bei Format-Fehler (keine '.' oder zu viele Teile)", () => {
    expect(verifySession("noformat", SECRET)).toBeNull();
    expect(verifySession("a.b.c", SECRET)).toBeNull();
    expect(verifySession("", SECRET)).toBeNull();
  });
});
