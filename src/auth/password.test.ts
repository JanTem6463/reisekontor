import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.ts";

describe("hashPassword + verifyPassword", () => {
  it("verifiziert einen frischen Hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("lehnt falsches Passwort ab", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "wrong horse")).toBe(false);
  });

  it("produziert unterschiedliche Hashes für gleiches Passwort (Salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "same")).toBe(true);
    expect(await verifyPassword(b, "same")).toBe(true);
  });

  it("erzeugt argon2id-Hashes (beginnen mit $argon2id$)", async () => {
    const hash = await hashPassword("any");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });
});
