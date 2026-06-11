import { hashPassword } from "../src/auth/password.ts";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: pnpm hash:password <plain-password>");
  process.exit(1);
}

const hash = await hashPassword(plain);
console.log(hash);
