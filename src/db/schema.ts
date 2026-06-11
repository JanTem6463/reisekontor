import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  startDate: text("start_date").notNull(), // ISO YYYY-MM-DD
  endDate: text("end_date").notNull(),
  uebernachtung: integer("uebernachtung", { mode: "boolean" }).notNull(),
});

export const dayEntries = sqliteTable("day_entries", {
  date: text("date").primaryKey(), // ISO YYYY-MM-DD
  year: integer("year").notNull(),
  type: text("type").notNull(),
  homeoffice: integer("homeoffice", { mode: "boolean" }).notNull().default(false),
  tripId: integer("trip_id").references(() => trips.id),
  fruehstueck: integer("fruehstueck", { mode: "boolean" }).notNull().default(false),
  mittag: integer("mittag", { mode: "boolean" }).notNull().default(false),
  abend: integer("abend", { mode: "boolean" }).notNull().default(false),
  zuzahlungCent: integer("zuzahlung_cent").notNull().default(0),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
