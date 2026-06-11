# Phase 1.B — CRUD-Routen + Service-Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Days/Trips/Summary-CRUD über Hono-Routen, dahinter Service-Layer mit DB↔Domain-Mapping. Trip-Mutationen transaktional mit Hart-Reset bei Update. Request-Logger (deferred aus 1.A) eingehängt.

**Architecture:** Pure-function Service-Layer (`(db, ...args) → result`), DB-Row↔Domain `mappers.ts` als einzige Konversionsstelle, Drizzle `db.transaction()` für Multi-Row-Operationen, `year` als required Query-Param-Achse.

**Tech Stack:** Bestehend aus 1.A (Hono, Drizzle, better-sqlite3, Zod, pino, vitest)

**Spec:** [2026-06-11-phase-1b-crud-design.md](../specs/2026-06-11-phase-1b-crud-design.md)

**CWD für alle Befehle:** `c:\Projekte\Reisen\reisekontor`

---

## File-Struktur am Ende dieser Phase

```
reisekontor/
├── src/
│   ├── services/                       # NEU
│   │   ├── mappers.ts
│   │   ├── mappers.test.ts
│   │   ├── days.ts
│   │   ├── days.test.ts
│   │   ├── trips.ts
│   │   ├── trips.test.ts
│   │   ├── summary.ts
│   │   └── summary.test.ts
│   └── server/
│       ├── index.ts                    # MODIFY — neue Routen + Logger einhängen
│       ├── middleware/
│       │   └── request-logger.ts       # NEU
│       └── routes/
│           ├── days.ts                 # NEU
│           ├── trips.ts                # NEU
│           └── summary.ts              # NEU
└── tests/
    ├── api-days.integration.test.ts    # NEU
    ├── api-trips.integration.test.ts   # NEU
    └── api-summary.integration.test.ts # NEU
```

---

## Task 1: Mappers (`src/services/mappers.ts`) + Tests

**Files:**
- Create: `src/services/mappers.ts`
- Create: `src/services/mappers.test.ts`

- [ ] **Step 1.1: Failing Test**

`src/services/mappers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { toDbDayInsert, toDomainDay } from "./mappers.ts";
import type { DayEntry } from "../domain/types.ts";

describe("toDomainDay", () => {
  it("bündelt flache DB-Felder zu meals-Objekt", () => {
    const row = {
      date: "2026-03-15",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: 7,
      fruehstueck: true,
      mittag: false,
      abend: true,
      zuzahlungCent: 300,
    } as const;
    expect(toDomainDay(row)).toEqual({
      date: "2026-03-15",
      type: "reise_voll",
      homeoffice: false,
      meals: { fruehstueck: true, mittag: false, abend: true },
      zuzahlungCent: 300,
    });
  });
});

describe("toDbDayInsert", () => {
  it("zerlegt meals-Objekt in flache DB-Felder", () => {
    const domain: DayEntry = {
      date: "2026-03-15",
      type: "homeoffice",
      homeoffice: true,
      meals: { fruehstueck: false, mittag: true, abend: false },
      zuzahlungCent: 0,
    };
    expect(toDbDayInsert(domain, 2026, null)).toEqual({
      date: "2026-03-15",
      year: 2026,
      type: "homeoffice",
      homeoffice: true,
      tripId: null,
      fruehstueck: false,
      mittag: true,
      abend: false,
      zuzahlungCent: 0,
    });
  });

  it("nimmt tripId an", () => {
    const domain: DayEntry = {
      date: "2026-04-01",
      type: "reise_anreise",
      homeoffice: true,
      meals: { fruehstueck: false, mittag: false, abend: false },
      zuzahlungCent: 0,
    };
    const inserted = toDbDayInsert(domain, 2026, 42);
    expect(inserted.tripId).toBe(42);
  });
});
```

- [ ] **Step 1.2: RED**
```bash
pnpm test src/services/mappers.test.ts
```

- [ ] **Step 1.3: Implementierung**

`src/services/mappers.ts`:
```ts
import type { dayEntries } from "../db/schema.ts";
import type { DayEntry, DayType } from "../domain/types.ts";

type DbDayRow = typeof dayEntries.$inferSelect;
type DbDayInsert = typeof dayEntries.$inferInsert;

export function toDomainDay(row: DbDayRow): DayEntry {
  return {
    date: row.date,
    type: row.type as DayType,
    homeoffice: row.homeoffice,
    meals: {
      fruehstueck: row.fruehstueck,
      mittag: row.mittag,
      abend: row.abend,
    },
    zuzahlungCent: row.zuzahlungCent,
  };
}

export function toDbDayInsert(
  domain: DayEntry,
  year: number,
  tripId: number | null,
): DbDayInsert {
  return {
    date: domain.date,
    year,
    type: domain.type,
    homeoffice: domain.homeoffice,
    tripId,
    fruehstueck: domain.meals.fruehstueck,
    mittag: domain.meals.mittag,
    abend: domain.meals.abend,
    zuzahlungCent: domain.zuzahlungCent,
  };
}
```

- [ ] **Step 1.4: GREEN**
```bash
pnpm test src/services/mappers.test.ts
pnpm typecheck
```

- [ ] **Step 1.5: Commit**
```bash
git add src/services/mappers.ts src/services/mappers.test.ts
git commit -m "feat(services): mappers für DB-Row ↔ Domain-DayEntry

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Days Service (`src/services/days.ts`) + Tests

**Files:**
- Create: `src/services/days.ts`
- Create: `src/services/days.test.ts`

- [ ] **Step 2.1: Failing Test**

`src/services/days.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client.ts";
import { dayEntries } from "../db/schema.ts";
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
```

- [ ] **Step 2.2: RED**

- [ ] **Step 2.3: Implementierung**

`src/services/days.ts`:
```ts
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
```

- [ ] **Step 2.4: GREEN**

- [ ] **Step 2.5: Commit**
```bash
git add src/services/days.ts src/services/days.test.ts
git commit -m "feat(services): days service mit list/get/upsert/delete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Trips Service (`src/services/trips.ts`) + Tests

**Files:**
- Create: `src/services/trips.ts`
- Create: `src/services/trips.test.ts`

Trips ist der komplexeste Service — Transaktionen, Domain-Aufruf, Day-Entry-Erzeugung.

- [ ] **Step 3.1: Failing Test**

`src/services/trips.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client.ts";
import * as daysService from "./days.ts";
import * as tripsService from "./trips.ts";

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("Trips Service — create", () => {
  it("3-Tages-Reise mit Übernachtung erzeugt Anreise + Voll + Abreise", () => {
    const result = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    expect(result.trip.year).toBe(2026);
    expect(result.trip.uebernachtung).toBe(true);
    expect(result.days).toHaveLength(3);
    expect(result.days.map((d) => d.type)).toEqual([
      "reise_anreise",
      "reise_voll",
      "reise_abreise",
    ]);
    expect(result.days.every((d) => d.tripId === result.trip.id)).toBe(true);
  });

  it("eintägige Reise ohne Übernachtung erzeugt 1 Day-Entry", () => {
    const result = tripsService.create(db, {
      startDate: "2026-05-10",
      endDate: "2026-05-10",
      uebernachtung: false,
    });
    expect(result.days).toHaveLength(1);
    expect(result.days[0]?.type).toBe("reise_eintaegig");
  });

  it("ungültige TripInput → wirft", () => {
    expect(() =>
      tripsService.create(db, {
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        uebernachtung: true,
      }),
    ).toThrow(/eintägig kann keine Übernachtung haben/);
  });

  it("Date-Konflikt mit existierendem Day-Entry → wirft, kein Trip persistiert", () => {
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "homeoffice",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    expect(() =>
      tripsService.create(db, {
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        uebernachtung: true,
      }),
    ).toThrow();
    expect(tripsService.listForYear(db, 2026)).toHaveLength(0);
  });
});

describe("Trips Service — update (Hart-Reset)", () => {
  it("ändert Zeitraum und ersetzt Day-Entries komplett", () => {
    const original = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    // Manuelle Mahlzeit setzen
    daysService.upsert(db, {
      date: "2026-04-02",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: original.trip.id,
      fruehstueck: false,
      mittag: true,
      abend: false,
      zuzahlungCent: 0,
    });

    const updated = tripsService.update(db, original.trip.id, {
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      uebernachtung: true,
    });
    expect(updated?.days).toHaveLength(5);
    // Manuelle Mahlzeit weg (Hart-Reset)
    const apr2 = daysService.get(db, "2026-04-02");
    expect(apr2?.mittag).toBe(false);
  });

  it("liefert null bei nicht existierender ID", () => {
    expect(
      tripsService.update(db, 9999, {
        startDate: "2026-04-01",
        endDate: "2026-04-02",
        uebernachtung: true,
      }),
    ).toBeNull();
  });
});

describe("Trips Service — delete + list + get", () => {
  it("delete entfernt Trip + alle Day-Entries", () => {
    const trip = tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    expect(tripsService.deleteById(db, trip.trip.id)).toEqual({ deleted: true });
    expect(tripsService.listForYear(db, 2026)).toEqual([]);
    expect(daysService.listForYear(db, 2026)).toEqual([]);
  });

  it("delete auf nicht existierender ID → deleted: false", () => {
    expect(tripsService.deleteById(db, 9999)).toEqual({ deleted: false });
  });

  it("listForYear gruppiert trips mit ihren days", () => {
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      uebernachtung: true,
    });
    tripsService.create(db, {
      startDate: "2026-05-10",
      endDate: "2026-05-10",
      uebernachtung: false,
    });
    const list = tripsService.listForYear(db, 2026);
    expect(list).toHaveLength(2);
    expect(list[0]?.days).toHaveLength(2);
    expect(list[1]?.days).toHaveLength(1);
  });

  it("get liefert TripWithDays für existierende ID", () => {
    const created = tripsService.create(db, {
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      uebernachtung: true,
    });
    const fetched = tripsService.get(db, created.trip.id);
    expect(fetched?.trip.id).toBe(created.trip.id);
    expect(fetched?.days).toHaveLength(2);
  });
});
```

- [ ] **Step 3.2: RED**

- [ ] **Step 3.3: Implementierung**

`src/services/trips.ts`:
```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dayEntries, trips } from "../db/schema.ts";
import { classifyTrip } from "../domain/trip-classify.ts";
import type { TripInput } from "../domain/types.ts";

type DbDayRow = typeof dayEntries.$inferSelect;
type DbTripRow = typeof trips.$inferSelect;

export interface TripWithDays {
  trip: DbTripRow;
  days: DbDayRow[];
}

export function listForYear(db: Db, year: number): TripWithDays[] {
  const tripRows = db.select().from(trips).where(eq(trips.year, year)).all();
  return tripRows.map((trip) => ({
    trip,
    days: db.select().from(dayEntries).where(eq(dayEntries.tripId, trip.id)).all(),
  }));
}

export function get(db: Db, id: number): TripWithDays | null {
  const tripRows = db.select().from(trips).where(eq(trips.id, id)).all();
  const trip = tripRows[0];
  if (!trip) return null;
  return {
    trip,
    days: db.select().from(dayEntries).where(eq(dayEntries.tripId, trip.id)).all(),
  };
}

export function create(db: Db, input: TripInput): TripWithDays {
  const classified = classifyTrip(input); // wirft bei ungültigen Eingaben
  const year = Number.parseInt(input.startDate.slice(0, 4), 10);

  return db.transaction((tx) => {
    const [insertedTrip] = tx
      .insert(trips)
      .values({
        year,
        startDate: input.startDate,
        endDate: input.endDate,
        uebernachtung: input.uebernachtung,
      })
      .returning()
      .all();
    if (!insertedTrip) throw new Error("Trip-Insert lieferte keine Row zurück");

    const dayInserts = classified.map((c) => ({
      date: c.date,
      year: Number.parseInt(c.date.slice(0, 4), 10),
      type: c.type,
      homeoffice: false,
      tripId: insertedTrip.id,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    }));
    const insertedDays = tx.insert(dayEntries).values(dayInserts).returning().all();

    return { trip: insertedTrip, days: insertedDays };
  });
}

export function update(db: Db, id: number, input: TripInput): TripWithDays | null {
  const existing = get(db, id);
  if (!existing) return null;

  const classified = classifyTrip(input); // wirft bei ungültiger Eingabe
  const year = Number.parseInt(input.startDate.slice(0, 4), 10);

  return db.transaction((tx) => {
    // Hart-Reset: alte day_entries löschen
    tx.delete(dayEntries).where(eq(dayEntries.tripId, id)).run();

    // Trip-Row aktualisieren
    const [updatedTrip] = tx
      .update(trips)
      .set({
        year,
        startDate: input.startDate,
        endDate: input.endDate,
        uebernachtung: input.uebernachtung,
      })
      .where(eq(trips.id, id))
      .returning()
      .all();
    if (!updatedTrip) throw new Error("Trip-Update lieferte keine Row zurück");

    const dayInserts = classified.map((c) => ({
      date: c.date,
      year: Number.parseInt(c.date.slice(0, 4), 10),
      type: c.type,
      homeoffice: false,
      tripId: id,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    }));
    const insertedDays = tx.insert(dayEntries).values(dayInserts).returning().all();

    return { trip: updatedTrip, days: insertedDays };
  });
}

export function deleteById(db: Db, id: number): { deleted: boolean } {
  return db.transaction((tx) => {
    tx.delete(dayEntries).where(eq(dayEntries.tripId, id)).run();
    const result = tx.delete(trips).where(eq(trips.id, id)).run();
    return { deleted: result.changes > 0 };
  });
}
```

- [ ] **Step 3.4: GREEN**
```bash
pnpm test src/services/trips.test.ts
```

Wenn der "Date-Konflikt"-Test fehlschlägt, weil better-sqlite3's PK-Konflikt nicht propagiert: Drizzle's transaction sollte den Throw weiter werfen. Falls nicht, expliziter try/catch im Service mit Rethrow ist erlaubt.

- [ ] **Step 3.5: Commit**
```bash
git add src/services/trips.ts src/services/trips.test.ts
git commit -m "feat(services): trips service mit transaktionalem create/update (Hart-Reset)/delete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Summary Service (`src/services/summary.ts`) + Tests

**Files:**
- Create: `src/services/summary.ts`
- Create: `src/services/summary.test.ts`

- [ ] **Step 4.1: Failing Test**

`src/services/summary.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { createDb, type Db } from "../db/client.ts";
import * as daysService from "./days.ts";
import { computeSummary } from "./summary.ts";
import * as tripsService from "./trips.ts";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400,
        grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560,
        kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600,
        homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: (year) => {
    if (year !== 2026) throw new Error(`Keine Sätze für ${year}`);
    return {
      kleineCent: 1400,
      grosseCent: 2800,
      kuerzFruehstueckCent: 560,
      kuerzHauptCent: 1120,
      homeofficeProTagCent: 600,
      homeofficeMaxCent: 126000,
    };
  },
};

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("computeSummary", () => {
  it("leeres Jahr → alle Werte 0, max-Werte aus config", () => {
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.verpflegungSummeCent).toBe(0);
    expect(result.kuerzungSummeCent).toBe(0);
    expect(result.homeofficeTage).toBe(0);
    expect(result.homeofficeBetragCent).toBe(0);
    expect(result.homeofficeMaxTage).toBe(210);
    expect(result.homeofficeMaxBetragCent).toBe(126000);
    expect(result.reisenAnzahl).toBe(0);
    expect(result.reisetageNachTyp).toEqual({
      reise_anreise: 0,
      reise_voll: 0,
      reise_abreise: 0,
      reise_eintaegig: 0,
    });
  });

  it("3-Tages-Reise ohne Mahlzeiten → 14 + 28 + 14 = 56 €", () => {
    tripsService.create(db, {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      uebernachtung: true,
    });
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.verpflegungSummeCent).toBe(1400 + 2800 + 1400);
    expect(result.reisenAnzahl).toBe(1);
    expect(result.reisetageNachTyp.reise_anreise).toBe(1);
    expect(result.reisetageNachTyp.reise_voll).toBe(1);
    expect(result.reisetageNachTyp.reise_abreise).toBe(1);
  });

  it("5 HO-Tage → 30 €", () => {
    for (let i = 1; i <= 5; i++) {
      daysService.upsert(db, {
        date: `2026-01-0${i}`,
        year: 2026,
        type: "homeoffice",
        homeoffice: false,
        tripId: null,
        fruehstueck: false,
        mittag: false,
        abend: false,
        zuzahlungCent: 0,
      });
    }
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.homeofficeTage).toBe(5);
    expect(result.homeofficeBetragCent).toBe(3000);
  });

  it("215 HO-Tage → Deckel 1.260 €", () => {
    for (let i = 0; i < 215; i++) {
      const month = Math.floor(i / 28) + 1;
      const day = (i % 28) + 1;
      daysService.upsert(db, {
        date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        year: 2026,
        type: "homeoffice",
        homeoffice: false,
        tripId: null,
        fruehstueck: false,
        mittag: false,
        abend: false,
        zuzahlungCent: 0,
      });
    }
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.homeofficeTage).toBe(215);
    expect(result.homeofficeBetragCent).toBe(126000);
  });

  it("Urlaub/Krankheit/Feiertag NICHT im HO-Zähler", () => {
    daysService.upsert(db, {
      date: "2026-07-01",
      year: 2026,
      type: "urlaub",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    daysService.upsert(db, {
      date: "2026-07-02",
      year: 2026,
      type: "krankheit",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    daysService.upsert(db, {
      date: "2026-12-25",
      year: 2026,
      type: "feiertag",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const result = computeSummary(db, 2026, fixtureConfig);
    expect(result.homeofficeTage).toBe(0);
  });
});
```

- [ ] **Step 4.2: RED**

- [ ] **Step 4.3: Implementierung**

`src/services/summary.ts`:
```ts
import type { AppConfig } from "../config/index.ts";
import type { Db } from "../db/client.ts";
import {
  homeofficePauschaleCent,
  homeofficeTage,
  kuerzungCent,
  verpflegungProTagCent,
} from "../domain/pauschalen.ts";
import type { DayType } from "../domain/types.ts";
import * as daysService from "./days.ts";
import { toDomainDay } from "./mappers.ts";
import * as tripsService from "./trips.ts";

export interface YearSummary {
  year: number;
  verpflegungSummeCent: number;
  kuerzungSummeCent: number;
  homeofficeTage: number;
  homeofficeMaxTage: number;
  homeofficeBetragCent: number;
  homeofficeMaxBetragCent: number;
  reisetageNachTyp: Record<
    "reise_anreise" | "reise_voll" | "reise_abreise" | "reise_eintaegig",
    number
  >;
  reisenAnzahl: number;
}

const REISE_TYPES: DayType[] = [
  "reise_anreise",
  "reise_voll",
  "reise_abreise",
  "reise_eintaegig",
];

export function computeSummary(db: Db, year: number, config: AppConfig): YearSummary {
  const rates = config.ratesForYear(year);
  const yearConfig = config.raw.jahre[String(year)];
  if (!yearConfig) throw new Error(`Keine Sätze für Jahr ${year}`);

  const dayRows = daysService.listForYear(db, year);
  const domainDays = dayRows.map(toDomainDay);
  const tripRows = tripsService.listForYear(db, year);

  let verpflegungSummeCent = 0;
  let kuerzungSummeCent = 0;
  const reisetageNachTyp: YearSummary["reisetageNachTyp"] = {
    reise_anreise: 0,
    reise_voll: 0,
    reise_abreise: 0,
    reise_eintaegig: 0,
  };

  for (const day of domainDays) {
    verpflegungSummeCent += verpflegungProTagCent(day, rates);
    if (REISE_TYPES.includes(day.type)) {
      kuerzungSummeCent += kuerzungCent(day.meals, rates);
      reisetageNachTyp[day.type as keyof typeof reisetageNachTyp] += 1;
    }
  }

  return {
    year,
    verpflegungSummeCent,
    kuerzungSummeCent,
    homeofficeTage: homeofficeTage(domainDays),
    homeofficeMaxTage: yearConfig.homeoffice_max_tage,
    homeofficeBetragCent: homeofficePauschaleCent(domainDays, rates),
    homeofficeMaxBetragCent: rates.homeofficeMaxCent,
    reisetageNachTyp,
    reisenAnzahl: tripRows.length,
  };
}
```

- [ ] **Step 4.4: GREEN**

- [ ] **Step 4.5: Commit**
```bash
git add src/services/summary.ts src/services/summary.test.ts
git commit -m "feat(services): computeSummary für jahres-kennzahlen

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Request-Logger Middleware

**Files:**
- Create: `src/server/middleware/request-logger.ts`

- [ ] **Step 5.1: Implementierung**

`src/server/middleware/request-logger.ts`:
```ts
import { createMiddleware } from "hono/factory";
import { logger as appLogger } from "../../shared/logger.ts";

export function requestLogger() {
  return createMiddleware(async (c, next) => {
    const start = Date.now();
    await next();
    const duration_ms = Date.now() - start;
    appLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration_ms,
      },
      "request",
    );
  });
}
```

- [ ] **Step 5.2: typecheck + lint**
```bash
pnpm typecheck
pnpm lint
```

- [ ] **Step 5.3: Commit**
```bash
git add src/server/middleware/request-logger.ts
git commit -m "feat(server): request-logger middleware mit pino

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Days Route (`src/server/routes/days.ts`) + Integration-Tests

**Files:**
- Create: `src/server/routes/days.ts`
- Create: `tests/api-days.integration.test.ts`

- [ ] **Step 6.1: Days Route schreiben**

`src/server/routes/days.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.ts";
import * as daysService from "../../services/days.ts";

const DayTypeSchema = z.enum([
  "homeoffice",
  "buero",
  "reise_anreise",
  "reise_voll",
  "reise_abreise",
  "reise_eintaegig",
  "urlaub",
  "krankheit",
  "feiertag",
]);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YearSchema = z.coerce.number().int().min(2020).max(2100);

const PutDayBody = z.object({
  type: DayTypeSchema,
  homeoffice: z.boolean().optional().default(false),
  tripId: z.number().int().nullable().optional().default(null),
  meals: z
    .object({
      fruehstueck: z.boolean().optional().default(false),
      mittag: z.boolean().optional().default(false),
      abend: z.boolean().optional().default(false),
    })
    .optional()
    .default({}),
  zuzahlungCent: z.number().int().nonnegative().optional().default(0),
});

const REISE_TYPES = new Set([
  "reise_anreise",
  "reise_voll",
  "reise_abreise",
  "reise_eintaegig",
]);

export interface DaysRouteDeps {
  db: Db;
}

export function createDaysRouter(deps: DaysRouteDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    const rows = daysService.listForYear(deps.db, yearParsed.data);
    return c.json(rows);
  });

  app.put("/:date", async (c) => {
    const date = c.req.param("date");
    if (!DateSchema.safeParse(date).success) {
      return c.json({ error: "invalid_query" }, 400);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = PutDayBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);

    const existing = daysService.get(deps.db, date);

    // Regel: neuer Eintrag mit Reise-Typ → 400
    if (!existing && REISE_TYPES.has(parsed.data.type)) {
      return c.json({ error: "reise_type_via_trips" }, 400);
    }

    // Regel: existing Reise-Tag, Type-Change verboten
    if (existing && REISE_TYPES.has(existing.type) && parsed.data.type !== existing.type) {
      return c.json({ error: "type_locked_for_trip_day" }, 400);
    }

    // Regel: existing mit tripId, body.tripId muss matchen
    if (existing && existing.tripId !== null) {
      if (parsed.data.tripId !== existing.tripId) {
        return c.json({ error: "trip_id_locked" }, 400);
      }
    }

    const year = Number.parseInt(date.slice(0, 4), 10);
    const result = daysService.upsert(deps.db, {
      date,
      year,
      type: parsed.data.type,
      homeoffice: parsed.data.homeoffice,
      tripId: parsed.data.tripId,
      fruehstueck: parsed.data.meals.fruehstueck,
      mittag: parsed.data.meals.mittag,
      abend: parsed.data.meals.abend,
      zuzahlungCent: parsed.data.zuzahlungCent,
    });
    return c.json({ ok: true, created: result.created });
  });

  app.delete("/:date", (c) => {
    const date = c.req.param("date");
    if (!DateSchema.safeParse(date).success) {
      return c.json({ error: "invalid_query" }, 400);
    }
    const existing = daysService.get(deps.db, date);
    if (existing && REISE_TYPES.has(existing.type)) {
      return c.json({ error: "reise_day_via_trip" }, 400);
    }
    const result = daysService.deleteByDate(deps.db, date);
    if (!result.deleted) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 6.2: Integration-Test**

`tests/api-days.integration.test.ts`:
```ts
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { hashPassword } from "../src/auth/password.ts";
import type { AppConfig } from "../src/config/index.ts";
import { createDb, type Db } from "../src/db/client.ts";
import { createServer } from "../src/server/index.ts";

const SECRET = "0".repeat(64);
const PLAIN = "TestPassword!23";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400,
        grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560,
        kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600,
        homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: () => ({
    kleineCent: 1400,
    grosseCent: 2800,
    kuerzFruehstueckCent: 560,
    kuerzHauptCent: 1120,
    homeofficeProTagCent: 600,
    homeofficeMaxCent: 126000,
  }),
};

let app: Hono;
let db: Db;
let authCookie: string;

beforeAll(async () => {
  db = createDb({ databasePath: ":memory:" });
  app = createServer({
    config: fixtureConfig,
    db,
    passwordHash: await hashPassword(PLAIN),
    sessionSecret: SECRET,
    isProduction: false,
  });
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PLAIN }),
  });
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  authCookie = /rk_session=([^;]+)/.exec(setCookie)?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/days", () => {
  it("GET ohne year → 400", async () => {
    const res = await authedReq("/api/days");
    expect(res.status).toBe(400);
  });

  it("GET leer → []", async () => {
    const res = await authedReq("/api/days?year=2026");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("PUT homeoffice → 200, GET zeigt 1", async () => {
    const put = await authedReq("/api/days/2026-03-15", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "homeoffice" }),
    });
    expect(put.status).toBe(200);
    const get = await authedReq("/api/days?year=2026");
    const list = (await get.json()) as Array<{ date: string; type: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.type).toBe("homeoffice");
  });

  it("PUT mit reise_anreise (kein existing) → 400 reise_type_via_trips", async () => {
    const res = await authedReq("/api/days/2026-04-01", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reise_anreise" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "reise_type_via_trips" });
  });

  it("PUT mit invalid type → 400 invalid_body", async () => {
    const res = await authedReq("/api/days/2026-04-01", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "unknown" }),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE existing → 200, danach GET zeigt 0", async () => {
    const del = await authedReq("/api/days/2026-03-15", { method: "DELETE" });
    expect(del.status).toBe(200);
    const list = (await (await authedReq("/api/days?year=2026")).json()) as Array<unknown>;
    expect(list).toHaveLength(0);
  });

  it("DELETE nicht existierend → 404", async () => {
    const res = await authedReq("/api/days/2026-12-31", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6.3: createServer um Days-Router erweitern**

WICHTIG: Diese Anpassung passt nur, wenn Task 6 vor Task 9 läuft. Für jetzt minimal in `src/server/index.ts` ergänzen — die anderen Routes kommen in Tasks 7/8 dazu.

In `src/server/index.ts`, importiere:
```ts
import { createDaysRouter } from "./routes/days.ts";
```

und unter dem `app.route("/api/health", ...)` füge ein:
```ts
app.route("/api/days", createDaysRouter({ db: deps.db }));
```

(Die nachfolgenden Routes für trips/summary werden in den jeweiligen Tasks ergänzt.)

- [ ] **Step 6.4: Tests laufen**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 1.A (77) + mappers (3) + days-service (8) + trips-service (10) + summary-service (5) + days-integration (7) ≈ 110 grün.

- [ ] **Step 6.5: Commit**
```bash
git add src/server/routes/days.ts src/server/index.ts tests/api-days.integration.test.ts
git commit -m "feat(server): /api/days CRUD-routen + integration-tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Trips Route (`src/server/routes/trips.ts`) + Integration-Tests

**Files:**
- Create: `src/server/routes/trips.ts`
- Create: `tests/api-trips.integration.test.ts`

- [ ] **Step 7.1: Trips Route schreiben**

`src/server/routes/trips.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.ts";
import * as tripsService from "../../services/trips.ts";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YearSchema = z.coerce.number().int().min(2020).max(2100);

const TripBody = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  uebernachtung: z.boolean(),
});

export interface TripsRouteDeps {
  db: Db;
}

export function createTripsRouter(deps: TripsRouteDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    return c.json(tripsService.listForYear(deps.db, yearParsed.data));
  });

  app.get("/:id", (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "invalid_query" }, 400);
    const trip = tripsService.get(deps.db, id);
    if (!trip) return c.json({ error: "not_found" }, 404);
    return c.json(trip);
  });

  app.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = TripBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    try {
      const result = tripsService.create(deps.db, parsed.data);
      return c.json(result, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // classifyTrip-Fehler → 400
      if (
        msg.includes("eintägig kann keine Übernachtung") ||
        msg.includes("endDate liegt vor startDate") ||
        msg.includes("Mehrtägige Reise ohne Übernachtung")
      ) {
        return c.json({ error: "invalid_trip_dates" }, 400);
      }
      // PK-Konflikt auf day_entries → 409
      if (msg.includes("UNIQUE") || msg.includes("PRIMARY KEY")) {
        return c.json({ error: "date_conflict" }, 409);
      }
      throw err;
    }
  });

  app.put("/:id", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "invalid_query" }, 400);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = TripBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    try {
      const result = tripsService.update(deps.db, id, parsed.data);
      if (!result) return c.json({ error: "not_found" }, 404);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("eintägig kann keine Übernachtung") ||
        msg.includes("endDate liegt vor startDate") ||
        msg.includes("Mehrtägige Reise ohne Übernachtung")
      ) {
        return c.json({ error: "invalid_trip_dates" }, 400);
      }
      if (msg.includes("UNIQUE") || msg.includes("PRIMARY KEY")) {
        return c.json({ error: "date_conflict" }, 409);
      }
      throw err;
    }
  });

  app.delete("/:id", (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "invalid_query" }, 400);
    const result = tripsService.deleteById(deps.db, id);
    if (!result.deleted) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 7.2: Integration-Test**

`tests/api-trips.integration.test.ts`:
```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { hashPassword } from "../src/auth/password.ts";
import type { AppConfig } from "../src/config/index.ts";
import { createDb, type Db } from "../src/db/client.ts";
import { createServer } from "../src/server/index.ts";

const SECRET = "0".repeat(64);
const PLAIN = "TestPassword!23";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400,
        grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560,
        kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600,
        homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: () => ({
    kleineCent: 1400,
    grosseCent: 2800,
    kuerzFruehstueckCent: 560,
    kuerzHauptCent: 1120,
    homeofficeProTagCent: 600,
    homeofficeMaxCent: 126000,
  }),
};

let app: Hono;
let db: Db;
let authCookie: string;

beforeAll(async () => {
  db = createDb({ databasePath: ":memory:" });
  app = createServer({
    config: fixtureConfig,
    db,
    passwordHash: await hashPassword(PLAIN),
    sessionSecret: SECRET,
    isProduction: false,
  });
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PLAIN }),
  });
  authCookie = /rk_session=([^;]+)/.exec(loginRes.headers.get("set-cookie") ?? "")?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/trips", () => {
  it("POST gültige Reise → 201, GET listet", async () => {
    const post = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        uebernachtung: true,
      }),
    });
    expect(post.status).toBe(201);
    const created = (await post.json()) as { trip: { id: number }; days: Array<unknown> };
    expect(created.days).toHaveLength(3);

    const get = await authedReq("/api/trips?year=2026");
    expect(get.status).toBe(200);
    const list = (await get.json()) as Array<unknown>;
    expect(list).toHaveLength(1);
  });

  it("POST eintägig + Übernachtung → 400 invalid_trip_dates", async () => {
    const res = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        uebernachtung: true,
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_trip_dates" });
  });

  it("POST mit Date-Konflikt → 409", async () => {
    // 1. Trip
    await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        uebernachtung: true,
      }),
    });
    // 2. Trip mit überlappendem Datum
    const res = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-06-02",
        endDate: "2026-06-04",
        uebernachtung: true,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("GET ohne year → 400", async () => {
    const res = await authedReq("/api/trips");
    expect(res.status).toBe(400);
  });

  it("GET /:id nicht existierend → 404", async () => {
    const res = await authedReq("/api/trips/9999");
    expect(res.status).toBe(404);
  });

  it("DELETE nicht existierend → 404", async () => {
    const res = await authedReq("/api/trips/9999", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("PUT auf existierender Trip → Hart-Reset", async () => {
    const create = await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-07-01",
        endDate: "2026-07-02",
        uebernachtung: true,
      }),
    });
    const { trip } = (await create.json()) as { trip: { id: number } };

    const update = await authedReq(`/api/trips/${trip.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        uebernachtung: true,
      }),
    });
    expect(update.status).toBe(200);
    const updated = (await update.json()) as { days: Array<unknown> };
    expect(updated.days).toHaveLength(5);
  });
});
```

- [ ] **Step 7.3: createServer um Trips-Router erweitern**

In `src/server/index.ts`:
```ts
import { createTripsRouter } from "./routes/trips.ts";
// ...
app.route("/api/trips", createTripsRouter({ db: deps.db }));
```

- [ ] **Step 7.4: Tests laufen**

- [ ] **Step 7.5: Commit**
```bash
git add src/server/routes/trips.ts src/server/index.ts tests/api-trips.integration.test.ts
git commit -m "feat(server): /api/trips CRUD-routen mit transaktionalem Hart-Reset

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Summary Route (`src/server/routes/summary.ts`) + Integration + createServer-Update

**Files:**
- Create: `src/server/routes/summary.ts`
- Create: `tests/api-summary.integration.test.ts`
- Modify: `src/server/index.ts` (Request-Logger einhängen)

- [ ] **Step 8.1: Summary Route schreiben**

`src/server/routes/summary.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import { computeSummary } from "../../services/summary.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);

export interface SummaryRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createSummaryRouter(deps: SummaryRouteDeps): Hono {
  const app = new Hono();
  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    try {
      return c.json(computeSummary(deps.db, yearParsed.data, deps.config));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Sätze für")) {
        return c.json({ error: "year_not_configured" }, 400);
      }
      throw err;
    }
  });
  return app;
}
```

- [ ] **Step 8.2: Integration-Test**

`tests/api-summary.integration.test.ts`:
```ts
import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { hashPassword } from "../src/auth/password.ts";
import type { AppConfig } from "../src/config/index.ts";
import { createDb, type Db } from "../src/db/client.ts";
import { createServer } from "../src/server/index.ts";

const SECRET = "0".repeat(64);
const PLAIN = "TestPassword!23";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400,
        grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560,
        kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600,
        homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: (year) => {
    if (year !== 2026) throw new Error(`Keine Sätze für ${year}`);
    return {
      kleineCent: 1400,
      grosseCent: 2800,
      kuerzFruehstueckCent: 560,
      kuerzHauptCent: 1120,
      homeofficeProTagCent: 600,
      homeofficeMaxCent: 126000,
    };
  },
};

let app: Hono;
let db: Db;
let authCookie: string;

beforeAll(async () => {
  db = createDb({ databasePath: ":memory:" });
  app = createServer({
    config: fixtureConfig,
    db,
    passwordHash: await hashPassword(PLAIN),
    sessionSecret: SECRET,
    isProduction: false,
  });
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PLAIN }),
  });
  authCookie = /rk_session=([^;]+)/.exec(loginRes.headers.get("set-cookie") ?? "")?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/summary", () => {
  it("leeres Jahr → 0/0/0", async () => {
    const res = await authedReq("/api/summary?year=2026");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verpflegungSummeCent: number;
      homeofficeTage: number;
      reisenAnzahl: number;
      homeofficeMaxTage: number;
    };
    expect(body.verpflegungSummeCent).toBe(0);
    expect(body.homeofficeTage).toBe(0);
    expect(body.reisenAnzahl).toBe(0);
    expect(body.homeofficeMaxTage).toBe(210);
  });

  it("nach POST /api/trips → Verpflegungssumme korrekt", async () => {
    await authedReq("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        uebernachtung: true,
      }),
    });
    const res = await authedReq("/api/summary?year=2026");
    const body = (await res.json()) as { verpflegungSummeCent: number; reisenAnzahl: number };
    expect(body.verpflegungSummeCent).toBe(1400 + 2800 + 1400);
    expect(body.reisenAnzahl).toBe(1);
  });

  it("ohne year → 400", async () => {
    const res = await authedReq("/api/summary");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 8.3: createServer-Update (alle Routen + Request-Logger)**

In `src/server/index.ts`:
- Imports ergänzen für `createDaysRouter`, `createTripsRouter`, `createSummaryRouter`, `requestLogger`
- `createServer`-Body anpassen:

```ts
export function createServer(deps: ServerDeps): Hono {
  const app = new Hono();

  // Request-Logger zuerst, damit auch 401/404/500 geloggt werden
  app.use("*", requestLogger());

  app.route(
    "/api/auth",
    createAuthRouter({
      passwordHash: deps.passwordHash,
      sessionSecret: deps.sessionSecret,
      isProduction: deps.isProduction,
    }),
  );

  app.use("/api/*", authMiddleware(deps.sessionSecret));

  app.route("/api/health", createHealthRouter());
  app.route("/api/days", createDaysRouter({ db: deps.db }));
  app.route("/api/trips", createTripsRouter({ db: deps.db }));
  app.route("/api/summary", createSummaryRouter({ db: deps.db, config: deps.config }));

  app.notFound((c) => c.json({ error: "not_found", hint: "UI kommt in Phase 2" }, 404));

  app.onError((err, c) => {
    appLogger.error({ err: err.message, path: c.req.path }, "request failed");
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
```

(Wenn die Days- und Trips-Routes-Registrationen schon in T6 und T7 ergänzt wurden, bleiben sie. Diese Step 8.3 ist hauptsächlich für die Summary-Route, den Request-Logger und die Konsolidierung.)

- [ ] **Step 8.4: Full Smoke**
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm lint:check
```

Expected: 1.A (77) + service-tests (~26) + integration-tests (~17) ≈ 120 grün.

- [ ] **Step 8.5: Manueller curl-Smoke (Live-Server)**

In einem Terminal:
```bash
pnpm dev
```

In zweitem Terminal:
```bash
# Login
curl -s -X POST -H "Content-Type: application/json" -d '{"password":"test123"}' http://localhost:3030/api/auth/login -c c:/tmp/cookie.txt

# Trip anlegen
curl -s -X POST -H "Content-Type: application/json" -b c:/tmp/cookie.txt \
  -d '{"startDate":"2026-04-01","endDate":"2026-04-03","uebernachtung":true}' \
  http://localhost:3030/api/trips

# Days listen
curl -s -b c:/tmp/cookie.txt 'http://localhost:3030/api/days?year=2026'

# Summary
curl -s -b c:/tmp/cookie.txt 'http://localhost:3030/api/summary?year=2026'
```

Expected: jeder Aufruf gibt ein sinnvolles JSON; Server-Stdout zeigt Request-Logs mit `method`, `path`, `status`, `duration_ms`.

Server stoppen (Ctrl+C).

- [ ] **Step 8.6: Commit**
```bash
git add src/server/routes/summary.ts src/server/index.ts tests/api-summary.integration.test.ts
git commit -m "feat(server): /api/summary route + request-logger eingehängt

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: CHANGELOG + Release

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (version → 0.3.0)

- [ ] **Step 9.1: CHANGELOG erweitern**

In `CHANGELOG.md` über `## [0.2.0]` einfügen:
```markdown
## [Unreleased]

## [0.3.0] — 2026-06-11

### Added
- `src/services/` — Service-Layer als pure functions:
  - `mappers.ts` — DB-Row ↔ Domain-DayEntry-Konversion.
  - `days.ts` — list/get/upsert/delete für Tageseinträge.
  - `trips.ts` — list/get/create/update (Hart-Reset)/delete für Reisen, transaktional.
  - `summary.ts` — `computeSummary()` für Jahres-Kennzahlen (Verpflegung, HO-Tage/-Betrag, Reisetage nach Typ).
- `src/server/routes/days.ts` — `GET /api/days?year`, `PUT /api/days/:date`, `DELETE /api/days/:date` mit Validierung für Reise-Tage und Kombi-Tage.
- `src/server/routes/trips.ts` — `GET /api/trips?year`, `GET /api/trips/:id`, `POST /api/trips`, `PUT /api/trips/:id`, `DELETE /api/trips/:id`.
- `src/server/routes/summary.ts` — `GET /api/summary?year`.
- `src/server/middleware/request-logger.ts` — pino-basiertes Request-Logging (method, path, status, duration_ms).
- Integration-Tests für `/api/days`, `/api/trips`, `/api/summary`.

### Changed
- `package.json` — Version 0.3.0.
- `src/server/index.ts` — neue Routen registriert, Request-Logger als erste Middleware eingehängt.
```

- [ ] **Step 9.2: package.json Version-Bump**

`"version": "0.2.0"` → `"version": "0.3.0"`.

- [ ] **Step 9.3: Release-Commit**
```bash
git add CHANGELOG.md package.json
git commit -m "chore: release 0.3.0 — phase 1.b complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 9.4: Final Smoke**
```bash
pnpm test
pnpm typecheck
pnpm lint:check
git status
git log --oneline | head -25
```

Working tree clean. Test count ~120. Commit log zeigt Phase 1.B Story.

---

## Phase-1.B-Abschluss-Kriterien

- [x] `pnpm dev` startet, Request-Logger erscheint (Task 8.5)
- [x] Alle neuen Endpoints reagieren wie spezifiziert (Tasks 6/7/8 + curl-Smoke)
- [x] `pnpm test` → ~120 Tests grün (Task 9.4)
- [x] `pnpm typecheck` + `pnpm lint:check` → grün (Task 9.4)
- [x] CHANGELOG `[0.3.0]` (Task 9.1)
- [x] Commit-Historie auf `main`
