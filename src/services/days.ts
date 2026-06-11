import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dayEntries } from "../db/schema.ts";

type DbDayRow = typeof dayEntries.$inferSelect;
type DbDayInsert = typeof dayEntries.$inferInsert;

export function listForYear(db: Db, year: number): DbDayRow[] {
  return db.select().from(dayEntries).where(eq(dayEntries.year, year)).all();
}

export function get(db: Db, date: string): DbDayRow | null {
  const rows = db.select().from(dayEntries).where(eq(dayEntries.date, date)).all();
  return rows[0] ?? null;
}

export function upsert(db: Db, row: DbDayInsert): { created: boolean } {
  const existing = get(db, row.date);
  if (existing) {
    db.update(dayEntries).set(row).where(eq(dayEntries.date, row.date)).run();
    return { created: false };
  }
  db.insert(dayEntries).values(row).run();
  return { created: true };
}

export function deleteByDate(db: Db, date: string): { deleted: boolean } {
  const result = db.delete(dayEntries).where(eq(dayEntries.date, date)).run();
  return { deleted: result.changes > 0 };
}
