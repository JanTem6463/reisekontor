# Phase 1.C — Feiertage + Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development.

**Goal:** `POST /api/holidays/sync?year=` legt gesetzliche Feiertage via `date-holidays` an (cleanup + idempotent + User-Override-respektierend). `GET /api/checks?year=` wrappt `plausibilitaet.checkAll()`. Release 0.4.0.

**Architecture:** Zwei neue Services (`holidays`, `checks`), zwei neue Routen, `createServer`-Update um die Routen zu registrieren.

**Tech Stack:** Bestehend aus 1.A/1.B + `date-holidays` NPM.

**Spec:** [2026-06-11-phase-1c-feiertage-checks-design.md](../specs/2026-06-11-phase-1c-feiertage-checks-design.md)

**CWD:** `c:\Projekte\Reisen\reisekontor`

---

## File-Struktur am Ende

```
reisekontor/
├── src/
│   ├── services/
│   │   ├── holidays.ts         # NEU
│   │   ├── holidays.test.ts
│   │   ├── checks.ts           # NEU
│   │   └── checks.test.ts
│   └── server/
│       ├── index.ts            # MODIFY — 2 neue Routen
│       └── routes/
│           ├── holidays.ts     # NEU
│           └── checks.ts       # NEU
└── tests/
    ├── api-holidays.integration.test.ts
    └── api-checks.integration.test.ts
```

---

## Task 1: date-holidays installieren + Holidays Service + Tests

**Files:**
- Modify: `package.json`
- Create: `src/services/holidays.ts`
- Create: `src/services/holidays.test.ts`

- [ ] **Step 1.1: Dependency installieren**
```bash
pnpm add -w date-holidays
```

- [ ] **Step 1.2: Failing Test schreiben**

`src/services/holidays.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client.ts";
import * as daysService from "./days.ts";
import { syncHolidaysForYear } from "./holidays.ts";

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("syncHolidaysForYear — NI 2026", () => {
  it("leerer DB → mindestens 9 Feiertage erzeugt (NI hat 9 gesetzliche)", () => {
    const result = syncHolidaysForYear(db, 2026, "NI");
    expect(result.year).toBe(2026);
    expect(result.bundesland).toBe("NI");
    expect(result.created).toBeGreaterThanOrEqual(9);
    expect(result.skipped).toEqual([]);
    const days = daysService.listForYear(db, 2026);
    expect(days.filter((d) => d.type === "feiertag").length).toBeGreaterThanOrEqual(9);
  });

  it("idempotent: zweiter Sync → keine doppelten Einträge", () => {
    syncHolidaysForYear(db, 2026, "NI");
    const before = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag").length;
    const result = syncHolidaysForYear(db, 2026, "NI");
    const after = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag").length;
    expect(after).toBe(before);
    // Nach Cleanup + Reinsert: alle als created gezählt
    expect(result.created).toBe(before);
    expect(result.skipped).toEqual([]);
  });

  it("User-Override: existing urlaub auf 01.05. → skipped", () => {
    daysService.upsert(db, {
      date: "2026-05-01",
      year: 2026,
      type: "urlaub",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const result = syncHolidaysForYear(db, 2026, "NI");
    expect(result.skipped.length).toBeGreaterThanOrEqual(1);
    const may1Skip = result.skipped.find((s) => s.date === "2026-05-01");
    expect(may1Skip?.existingType).toBe("urlaub");
    const may1Day = daysService.get(db, "2026-05-01");
    expect(may1Day?.type).toBe("urlaub"); // Override bleibt
  });

  it("User-Override mit reise_voll → skipped, Reise bleibt", () => {
    daysService.upsert(db, {
      date: "2026-12-25",
      year: 2026,
      type: "reise_voll",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const result = syncHolidaysForYear(db, 2026, "NI");
    expect(result.skipped.some((s) => s.date === "2026-12-25")).toBe(true);
    expect(daysService.get(db, "2026-12-25")?.type).toBe("reise_voll");
  });

  it("ungültiges Bundesland → wirft", () => {
    expect(() => syncHolidaysForYear(db, 2026, "XX")).toThrow();
  });
});

describe("syncHolidaysForYear — Bundesland-Wechsel-Cleanup", () => {
  it("alte feiertag-Einträge werden vor dem Sync entfernt", () => {
    // Erst NI syncen
    syncHolidaysForYear(db, 2026, "NI");
    const niCount = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag").length;
    expect(niCount).toBeGreaterThanOrEqual(9);

    // Jetzt BY (Bayern hat mehr Feiertage)
    const byResult = syncHolidaysForYear(db, 2026, "BY");
    const byDays = daysService.listForYear(db, 2026).filter((d) => d.type === "feiertag");
    // Bayern hat 13 Feiertage; nicht jeder NI-Feiertag (Reformationstag) ist BY-Feiertag → Cleanup nötig
    expect(byDays.length).toBe(byResult.created);
  });
});
```

- [ ] **Step 1.3: RED**
```bash
pnpm test src/services/holidays.test.ts
```

- [ ] **Step 1.4: Implementierung**

`src/services/holidays.ts`:
```ts
import Holidays from "date-holidays";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { dayEntries } from "../db/schema.ts";
import * as daysService from "./days.ts";

export interface HolidaysSyncResult {
  year: number;
  bundesland: string;
  created: number;
  skipped: Array<{ date: string; existingType: string }>;
}

export function syncHolidaysForYear(
  db: Db,
  year: number,
  bundesland: string,
): HolidaysSyncResult {
  const hd = new Holidays("DE", bundesland);
  const allHolidays = hd.getHolidays(year);
  if (!Array.isArray(allHolidays) || allHolidays.length === 0) {
    throw new Error(`Keine Feiertage für DE/${bundesland} ${year} gefunden`);
  }
  const publicHolidays = allHolidays.filter((h) => h.type === "public");

  return db.transaction((tx) => {
    // Cleanup: alle existierenden feiertag-Einträge des Jahres löschen
    tx
      .delete(dayEntries)
      .where(and(eq(dayEntries.year, year), eq(dayEntries.type, "feiertag")))
      .run();

    let created = 0;
    const skipped: Array<{ date: string; existingType: string }> = [];

    for (const holiday of publicHolidays) {
      const date = holiday.date.slice(0, 10); // "2026-12-25"
      const existing = daysService.get(tx as unknown as Db, date);
      if (existing) {
        skipped.push({ date, existingType: existing.type });
        continue;
      }
      tx
        .insert(dayEntries)
        .values({
          date,
          year,
          type: "feiertag",
          homeoffice: false,
          tripId: null,
          fruehstueck: false,
          mittag: false,
          abend: false,
          zuzahlungCent: 0,
        })
        .run();
      created++;
    }

    return { year, bundesland, created, skipped };
  });
}
```

Hinweis: `tx as unknown as Db` ist nötig, weil Drizzle's Transaction-Typ nicht der `Db`-Aliasname ist, aber die select-API kompatibel. Wenn das Compile-Probleme macht, alternative ist `tx.select().from(dayEntries).where(eq(dayEntries.date, date)).all()[0] ?? null` inline statt `daysService.get(tx, date)`.

- [ ] **Step 1.5: GREEN**
```bash
pnpm test src/services/holidays.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 1.6: Commit**
```bash
git add package.json pnpm-lock.yaml src/services/holidays.ts src/services/holidays.test.ts
git commit -m "feat(services): syncHolidaysForYear via date-holidays mit cleanup+user-override

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Checks Service + Tests

**Files:**
- Create: `src/services/checks.ts`
- Create: `src/services/checks.test.ts`

- [ ] **Step 2.1: Failing Test schreiben**

`src/services/checks.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client.ts";
import { checkYear } from "./checks.ts";
import * as daysService from "./days.ts";

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("checkYear", () => {
  it("leeres Jahr → []", () => {
    expect(checkYear(db, 2026)).toEqual([]);
  });

  it("homeoffice-Tag → HO_KONFLIKT_ENTFERNUNG", () => {
    daysService.upsert(db, {
      date: "2026-03-15",
      year: 2026,
      type: "homeoffice",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const hinweise = checkYear(db, 2026);
    expect(hinweise).toHaveLength(1);
    expect(hinweise[0]?.code).toBe("HO_KONFLIKT_ENTFERNUNG");
    expect(hinweise[0]?.date).toBe("2026-03-15");
  });

  it("reise_voll + homeoffice=true → DOPPEL_HO_REISE_VOLL", () => {
    daysService.upsert(db, {
      date: "2026-03-15",
      year: 2026,
      type: "reise_voll",
      homeoffice: true,
      tripId: 1,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    const hinweise = checkYear(db, 2026);
    expect(hinweise.some((h) => h.code === "DOPPEL_HO_REISE_VOLL")).toBe(true);
  });

  it("filtert nach Jahr — andere Jahre nicht mit drin", () => {
    daysService.upsert(db, {
      date: "2025-12-31",
      year: 2025,
      type: "homeoffice",
      homeoffice: false,
      tripId: null,
      fruehstueck: false,
      mittag: false,
      abend: false,
      zuzahlungCent: 0,
    });
    expect(checkYear(db, 2026)).toEqual([]);
  });
});
```

- [ ] **Step 2.2: RED**

- [ ] **Step 2.3: Implementierung**

`src/services/checks.ts`:
```ts
import type { Db } from "../db/client.ts";
import { checkAll, type PlausibilitaetHinweis } from "../domain/plausibilitaet.ts";
import * as daysService from "./days.ts";
import { toDomainDay } from "./mappers.ts";

export function checkYear(db: Db, year: number): PlausibilitaetHinweis[] {
  const rows = daysService.listForYear(db, year);
  const domainDays = rows.map(toDomainDay);
  return checkAll(domainDays);
}
```

- [ ] **Step 2.4: GREEN**

- [ ] **Step 2.5: Commit**
```bash
git add src/services/checks.ts src/services/checks.test.ts
git commit -m "feat(services): checkYear wrappt plausibilitaet.checkAll() der domain

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Holidays Route + Integration-Test

**Files:**
- Create: `src/server/routes/holidays.ts`
- Create: `tests/api-holidays.integration.test.ts`

- [ ] **Step 3.1: Route schreiben**

`src/server/routes/holidays.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import { syncHolidaysForYear } from "../../services/holidays.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);

export interface HolidaysRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createHolidaysRouter(deps: HolidaysRouteDeps): Hono {
  const app = new Hono();

  app.post("/sync", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    try {
      const result = syncHolidaysForYear(
        deps.db,
        yearParsed.data,
        deps.config.raw.feiertage.bundesland,
      );
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Feiertage")) {
        return c.json({ error: "invalid_bundesland" }, 400);
      }
      throw err;
    }
  });

  return app;
}
```

- [ ] **Step 3.2: createServer um Holidays-Router erweitern**

In `src/server/index.ts`:
```ts
import { createHolidaysRouter } from "./routes/holidays.ts";
// ...nach den anderen route()-Calls:
app.route("/api/holidays", createHolidaysRouter({ db: deps.db, config: deps.config }));
```

- [ ] **Step 3.3: Integration-Test**

`tests/api-holidays.integration.test.ts`:
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
  authCookie = /rk_session=([^;]+)/.exec(loginRes.headers.get("set-cookie") ?? "")?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/holidays/sync", () => {
  it("POST mit year=2026 → 200 mit created>=9", async () => {
    const res = await authedReq("/api/holidays/sync?year=2026", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      year: number;
      bundesland: string;
      created: number;
      skipped: Array<unknown>;
    };
    expect(body.year).toBe(2026);
    expect(body.bundesland).toBe("NI");
    expect(body.created).toBeGreaterThanOrEqual(9);
  });

  it("POST ohne year → 400", async () => {
    const res = await authedReq("/api/holidays/sync", { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("nach Sync sind die Feiertage in /api/days sichtbar", async () => {
    // Sync (idempotent)
    await authedReq("/api/holidays/sync?year=2026", { method: "POST" });
    const days = await authedReq("/api/days?year=2026");
    const list = (await days.json()) as Array<{ type: string }>;
    expect(list.filter((d) => d.type === "feiertag").length).toBeGreaterThanOrEqual(9);
  });
});
```

- [ ] **Step 3.4: Tests laufen**
```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 120 + holidays-service (~6) + checks-service (4) + holidays-integration (3) = ~133. (Checks-Integration kommt in T4.)

- [ ] **Step 3.5: Commit**
```bash
git add src/server/routes/holidays.ts src/server/index.ts tests/api-holidays.integration.test.ts
git commit -m "feat(server): /api/holidays/sync route + integration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Checks Route + Integration-Test

**Files:**
- Create: `src/server/routes/checks.ts`
- Create: `tests/api-checks.integration.test.ts`

- [ ] **Step 4.1: Route schreiben**

`src/server/routes/checks.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.ts";
import { checkYear } from "../../services/checks.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);

export interface ChecksRouteDeps {
  db: Db;
}

export function createChecksRouter(deps: ChecksRouteDeps): Hono {
  const app = new Hono();
  app.get("/", (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    return c.json(checkYear(deps.db, yearParsed.data));
  });
  return app;
}
```

- [ ] **Step 4.2: createServer um Checks-Router erweitern**

In `src/server/index.ts`:
```ts
import { createChecksRouter } from "./routes/checks.ts";
// ...
app.route("/api/checks", createChecksRouter({ db: deps.db }));
```

- [ ] **Step 4.3: Integration-Test**

`tests/api-checks.integration.test.ts`:
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
  authCookie = /rk_session=([^;]+)/.exec(loginRes.headers.get("set-cookie") ?? "")?.[1] ?? "";
});

function authedReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: { ...init?.headers, Cookie: `rk_session=${authCookie}` },
  });
}

describe("/api/checks", () => {
  it("leeres Jahr → []", async () => {
    const res = await authedReq("/api/checks?year=2026");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("nach PUT homeoffice → HO_KONFLIKT_ENTFERNUNG", async () => {
    await authedReq("/api/days/2026-03-15", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "homeoffice" }),
    });
    const res = await authedReq("/api/checks?year=2026");
    const hinweise = (await res.json()) as Array<{ code: string; date: string }>;
    expect(hinweise.some((h) => h.code === "HO_KONFLIKT_ENTFERNUNG")).toBe(true);
  });

  it("ohne year → 400", async () => {
    const res = await authedReq("/api/checks");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4.4: Tests laufen**
```bash
pnpm test
pnpm typecheck
pnpm lint:check
```

Expected: ~136 grün.

- [ ] **Step 4.5: Commit**
```bash
git add src/server/routes/checks.ts src/server/index.ts tests/api-checks.integration.test.ts
git commit -m "feat(server): /api/checks route + integration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: CHANGELOG + Release 0.4.0

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 5.1: CHANGELOG erweitern**

In `CHANGELOG.md` über `## [0.3.0]` einfügen:
```markdown
## [Unreleased]

## [0.4.0] — 2026-06-11

### Added
- `src/services/holidays.ts` — `syncHolidaysForYear(db, year, bundesland)` mit Cleanup + Idempotenz + User-Override-Respekt.
- `src/services/checks.ts` — `checkYear(db, year)` wrappt `plausibilitaet.checkAll()` der Domain.
- `src/server/routes/holidays.ts` — `POST /api/holidays/sync?year`.
- `src/server/routes/checks.ts` — `GET /api/checks?year`.
- Dependency `date-holidays` für gesetzliche Feiertage je Bundesland.
- Integration-Tests für `/api/holidays/sync` und `/api/checks`.

### Changed
- `package.json` — Version 0.4.0.
- `src/server/index.ts` — neue Routen `/api/holidays` und `/api/checks` registriert.
```

- [ ] **Step 5.2: package.json Version-Bump**

`"version": "0.3.0"` → `"version": "0.4.0"`.

- [ ] **Step 5.3: Release-Commit**
```bash
git add CHANGELOG.md package.json
git commit -m "chore: release 0.4.0 — phase 1.c complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 5.4: Final Smoke**
```bash
pnpm test
pnpm typecheck
pnpm lint:check
git status
git log --oneline | head -25
```

Working tree clean. Test count ~136. Commit log zeigt Phase 1.C Story.

---

## Phase-1.C-Abschluss-Kriterien

- [x] `pnpm dev` startet wie zuvor (kein Code-Change am Server-Bootstrap)
- [x] `POST /api/holidays/sync?year=2026` → 200 mit Feiertagsliste
- [x] `GET /api/checks?year=2026` → 200 mit Hinweis-Array
- [x] `pnpm test` → ~136 Tests grün
- [x] `pnpm typecheck` und `pnpm lint:check` → grün
- [x] CHANGELOG `[0.4.0]`
- [x] Commit-Historie auf `main`
