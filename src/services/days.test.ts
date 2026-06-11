import { beforeEach, describe, expect, it } from "vitest";
import { type Db, createDb } from "../db/client.ts";
import * as daysService from "./days.ts";

let db: Db;

beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

const sampleInsert = {
  date: "2026-03-15",
  year: 2026,
  type: "homeoffice",
  homeoffice: false,
  tripId: null,
  fruehstueck: false,
  mittag: false,
  abend: false,
  zuzahlungCent: 0,
} as const;

describe("Days Service", () => {
  it("listForYear ohne Einträge → leer", () => {
    expect(daysService.listForYear(db, 2026)).toEqual([]);
  });

  it("upsert legt neuen Eintrag an", () => {
    const result = daysService.upsert(db, sampleInsert);
    expect(result.created).toBe(true);
    expect(daysService.listForYear(db, 2026)).toHaveLength(1);
  });

  it("upsert auf existierendes Datum überschreibt", () => {
    daysService.upsert(db, sampleInsert);
    const result = daysService.upsert(db, {
      ...sampleInsert,
      type: "urlaub",
      mittag: true,
    });
    expect(result.created).toBe(false);
    const list = daysService.listForYear(db, 2026);
    expect(list).toHaveLength(1);
    expect(list[0]?.type).toBe("urlaub");
    expect(list[0]?.mittag).toBe(true);
  });

  it("get liefert null, wenn Eintrag fehlt", () => {
    expect(daysService.get(db, "2026-12-31")).toBeNull();
  });

  it("get liefert die Row, wenn Eintrag existiert", () => {
    daysService.upsert(db, sampleInsert);
    const row = daysService.get(db, "2026-03-15");
    expect(row?.type).toBe("homeoffice");
  });

  it("deleteByDate auf fehlendem Datum → deleted: false", () => {
    expect(daysService.deleteByDate(db, "2026-12-31")).toEqual({ deleted: false });
  });

  it("deleteByDate auf existierendem Datum → deleted: true und Eintrag weg", () => {
    daysService.upsert(db, sampleInsert);
    expect(daysService.deleteByDate(db, "2026-03-15")).toEqual({ deleted: true });
    expect(daysService.listForYear(db, 2026)).toHaveLength(0);
  });

  it("listForYear filtert nach Jahr", () => {
    daysService.upsert(db, { ...sampleInsert, date: "2025-12-31", year: 2025 });
    daysService.upsert(db, { ...sampleInsert, date: "2026-01-01", year: 2026 });
    expect(daysService.listForYear(db, 2025)).toHaveLength(1);
    expect(daysService.listForYear(db, 2026)).toHaveLength(1);
  });
});
