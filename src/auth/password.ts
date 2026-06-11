import argon2 from "argon2";

/**
 * argon2id-Hash mit OWASP-2026-konformen Defaults aus der argon2-Library.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
