import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

export interface CreateDbOptions {
  databasePath: string;
  migrationsFolder?: string;
}

export function createDb(opts: CreateDbOptions): Db {
  if (opts.databasePath !== ":memory:") {
    mkdirSync(dirname(opts.databasePath), { recursive: true });
  }
  const sqlite = new Database(opts.databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: opts.migrationsFolder ?? "src/db/migrations" });
  return db;
}
