# Phase 2.C — Reisen + Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development.

**Goal:** Reisen-CRUD-Seite + Einstellungen-Seite (Bundesland mit auto-Holidays-Sync + Standardwoche + Pauschalen-Read-Only) + Backend `/api/settings` Endpoint mit Key-Value-Persistenz.

**Architecture:** Settings als Key-Value-Pattern in der existing `settings`-Tabelle (Phase 1.A), `getEffectiveSettings(db, config)` mergt DB-Override über Config-Default. Trips-CRUD-Hooks analog zu Day-Hooks (2.B-Pattern), nur ohne Optimistic für create/update (classifyTrip-Logik bleibt Backend-only).

**Tech Stack ergänzt:** shadcn `alert-dialog`, `table`.

**Spec:** [2026-06-11-phase-2c-reisen-settings-design.md](../specs/2026-06-11-phase-2c-reisen-settings-design.md)

**CWD:** `c:\Projekte\Reisen\reisekontor`

---

## Task 1: Backend Settings Service + Tests

**Files:**
- Create: `src/services/settings.ts`
- Create: `src/services/settings.test.ts`

- [ ] **Step 1.1: Failing Tests**

`src/services/settings.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config/index.ts";
import { createDb, type Db } from "../db/client.ts";
import { getEffectiveSettings, updateSettings } from "./settings.ts";

const fixtureConfig: AppConfig = {
  raw: {
    jahre: {
      "2026": {
        kleine_cent: 1400, grosse_cent: 2800,
        kuerz_fruehstueck_cent: 560, kuerz_haupt_cent: 1120,
        homeoffice_pro_tag_cent: 600, homeoffice_max_tage: 210,
        homeoffice_max_cent: 126000,
      },
    },
    standardwoche: { mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false },
    feiertage: { bundesland: "NI" },
  },
  ratesForYear: () => ({
    kleineCent: 1400, grosseCent: 2800,
    kuerzFruehstueckCent: 560, kuerzHauptCent: 1120,
    homeofficeProTagCent: 600, homeofficeMaxCent: 126000,
  }),
};

let db: Db;
beforeEach(() => {
  db = createDb({ databasePath: ":memory:" });
});

describe("getEffectiveSettings", () => {
  it("ohne DB-Override → Config-Werte", () => {
    const s = getEffectiveSettings(db, fixtureConfig);
    expect(s.bundesland).toBe("NI");
    expect(s.standardwoche.mo).toBe(true);
    expect(s.standardwoche.sa).toBe(false);
  });

  it("mit DB-Override → DB-Werte gewinnen", () => {
    updateSettings(db, { bundesland: "BY" });
    const s = getEffectiveSettings(db, fixtureConfig);
    expect(s.bundesland).toBe("BY");
  });
});

describe("updateSettings", () => {
  it("speichert bundesland", () => {
    const s = updateSettings(db, { bundesland: "BY" });
    expect(s.bundesland).toBe("BY");
    expect(getEffectiveSettings(db, fixtureConfig).bundesland).toBe("BY");
  });

  it("speichert standardwoche", () => {
    const sw = { mo: false, di: false, mi: false, do: false, fr: false, sa: true, so: true };
    const s = updateSettings(db, { standardwoche: sw });
    expect(s.standardwoche).toEqual(sw);
  });

  it("partial update — bundesland bleibt erhalten", () => {
    updateSettings(db, { bundesland: "BY" });
    updateSettings(db, { standardwoche: {
      mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false,
    }});
    const s = getEffectiveSettings(db, fixtureConfig);
    expect(s.bundesland).toBe("BY");
  });

  it("ungültiges Bundesland → wirft", () => {
    expect(() => updateSettings(db, { bundesland: "XX" })).toThrow();
  });

  it("Bundesland anderer Länge → wirft", () => {
    expect(() => updateSettings(db, { bundesland: "NIEDERSACHSEN" })).toThrow();
  });
});
```

- [ ] **Step 1.2: RED**
```bash
pnpm test src/services/settings.test.ts
```

- [ ] **Step 1.3: Implementierung**

`src/services/settings.ts`:
```ts
import Holidays from "date-holidays";
import { eq } from "drizzle-orm";
import type { AppConfig } from "../config/index.ts";
import type { Db } from "../db/client.ts";
import { settings } from "../db/schema.ts";

const KEY_BUNDESLAND = "bundesland";
const KEY_STANDARDWOCHE = "standardwoche";

export interface Standardwoche {
  mo: boolean; di: boolean; mi: boolean; do: boolean;
  fr: boolean; sa: boolean; so: boolean;
}

export interface EffectiveSettings {
  bundesland: string;
  standardwoche: Standardwoche;
}

const VALID_DE_STATES = new Set(
  new Holidays().getStates("DE") ? Object.keys(new Holidays().getStates("DE")) : [],
);

function readKey(db: Db, key: string): string | null {
  const rows = db.select().from(settings).where(eq(settings.key, key)).all();
  return rows[0]?.value ?? null;
}

function writeKey(db: Db, key: string, value: string): void {
  const existing = readKey(db, key);
  if (existing === null) {
    db.insert(settings).values({ key, value }).run();
  } else {
    db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  }
}

export function getEffectiveSettings(db: Db, config: AppConfig): EffectiveSettings {
  const dbBundesland = readKey(db, KEY_BUNDESLAND);
  const dbStandardwocheJson = readKey(db, KEY_STANDARDWOCHE);
  let standardwoche: Standardwoche = config.raw.standardwoche;
  if (dbStandardwocheJson) {
    try {
      standardwoche = JSON.parse(dbStandardwocheJson) as Standardwoche;
    } catch {
      // Fallback auf Config bei korrupter Row
    }
  }
  return {
    bundesland: dbBundesland ?? config.raw.feiertage.bundesland,
    standardwoche,
  };
}

function validateBundesland(value: string): void {
  if (value.length !== 2) {
    throw new Error(`Ungültiges Bundesland (Länge ≠ 2): ${value}`);
  }
  if (!VALID_DE_STATES.has(value)) {
    throw new Error(`Ungültiges Bundesland: ${value}`);
  }
}

function validateStandardwoche(value: unknown): asserts value is Standardwoche {
  const keys = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
  if (!value || typeof value !== "object") {
    throw new Error("standardwoche muss ein Objekt sein");
  }
  for (const k of keys) {
    const v = (value as Record<string, unknown>)[k];
    if (typeof v !== "boolean") {
      throw new Error(`standardwoche.${k} muss boolean sein`);
    }
  }
}

export interface UpdateSettingsBody {
  bundesland?: string;
  standardwoche?: Standardwoche;
}

export function updateSettings(db: Db, body: UpdateSettingsBody): EffectiveSettings {
  if (body.bundesland !== undefined) {
    validateBundesland(body.bundesland);
    writeKey(db, KEY_BUNDESLAND, body.bundesland);
  }
  if (body.standardwoche !== undefined) {
    validateStandardwoche(body.standardwoche);
    writeKey(db, KEY_STANDARDWOCHE, JSON.stringify(body.standardwoche));
  }
  // Effective neu lesen — aber Config-Fallback brauchen wir nur, wenn DB-Key fehlt
  const bundesland = readKey(db, KEY_BUNDESLAND);
  const swJson = readKey(db, KEY_STANDARDWOCHE);
  if (!bundesland || !swJson) {
    throw new Error("Effective settings konnten nicht ermittelt werden");
  }
  return {
    bundesland,
    standardwoche: JSON.parse(swJson) as Standardwoche,
  };
}
```

**Wichtig:** `updateSettings` setzt voraus, dass beide Keys nach dem Update gelesen werden können. Für `getEffectiveSettings`-Aufrufe ist das egal (dort gibt es den Config-Fallback), aber `updateSettings` muss bei nur einem Feld update den anderen aus Config nachpopulieren. Saubere Variante:

Ersetze das `if (!bundesland || !swJson) throw ...` Block durch:
```ts
return getEffectiveSettings(db, /* config */);
```

Damit muss `updateSettings` aber `config` als Parameter bekommen. Adjuste die Signatur:
```ts
export function updateSettings(db: Db, body: UpdateSettingsBody, config: AppConfig): EffectiveSettings {
  // ... writeKey ...
  return getEffectiveSettings(db, config);
}
```

Und die Tests anpassen (zweiter Arg). Das ist die saubere Variante.

- [ ] **Step 1.4: GREEN**
```bash
pnpm test src/services/settings.test.ts
pnpm typecheck
```

- [ ] **Step 1.5: Commit**
```bash
git add src/services/settings.ts src/services/settings.test.ts
git commit -m "feat(services): settings service mit effective-pattern (db-override + config-fallback)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Backend Settings Route + Integration-Test + createServer-Update

**Files:**
- Create: `src/server/routes/settings.ts`
- Create: `tests/api-settings.integration.test.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 2.1: Route**

`src/server/routes/settings.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import { getEffectiveSettings, updateSettings } from "../../services/settings.ts";

const StandardwocheSchema = z.object({
  mo: z.boolean(), di: z.boolean(), mi: z.boolean(),
  do: z.boolean(), fr: z.boolean(), sa: z.boolean(), so: z.boolean(),
});

const UpdateBody = z.object({
  bundesland: z.string().length(2).optional(),
  standardwoche: StandardwocheSchema.optional(),
});

export interface SettingsRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createSettingsRouter(deps: SettingsRouteDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json(getEffectiveSettings(deps.db, deps.config));
  });

  app.put("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    try {
      const result = updateSettings(deps.db, parsed.data, deps.config);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Bundesland")) {
        return c.json({ error: "invalid_bundesland_in_settings" }, 400);
      }
      if (msg.includes("standardwoche")) {
        return c.json({ error: "invalid_standardwoche" }, 400);
      }
      throw err;
    }
  });

  return app;
}
```

- [ ] **Step 2.2: createServer-Update**

In `src/server/index.ts`:
```ts
import { createSettingsRouter } from "./routes/settings.ts";
// ...nach dem /api/checks Eintrag:
app.route("/api/settings", createSettingsRouter({ db: deps.db, config: deps.config }));
```

- [ ] **Step 2.3: Integration-Test**

`tests/api-settings.integration.test.ts` — Pattern identisch zu den anderen Integration-Tests (fixture config, hashPassword, login via app.request, authedReq helper):

```ts
// [Standard-Boilerplate aus tests/api-*.integration.test.ts — Login + authedReq]
// ...

describe("/api/settings", () => {
  it("GET ohne DB-Override → Config-Defaults", async () => {
    const res = await authedReq("/api/settings");
    expect(res.status).toBe(200);
    const body = await res.json() as { bundesland: string };
    expect(body.bundesland).toBe("NI");
  });

  it("PUT bundesland → 200, GET zeigt neuen Wert", async () => {
    const put = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundesland: "BY" }),
    });
    expect(put.status).toBe(200);
    const get = await authedReq("/api/settings");
    const body = await get.json() as { bundesland: string };
    expect(body.bundesland).toBe("BY");
  });

  it("PUT mit invalid bundesland → 400 invalid_bundesland_in_settings", async () => {
    const res = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundesland: "XX" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_bundesland_in_settings" });
  });

  it("PUT standardwoche → 200, GET zeigt neuen Wert", async () => {
    const sw = { mo: false, di: false, mi: false, do: false, fr: false, sa: true, so: true };
    const put = await authedReq("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardwoche: sw }),
    });
    expect(put.status).toBe(200);
    const get = await authedReq("/api/settings");
    const body = await get.json() as { standardwoche: typeof sw };
    expect(body.standardwoche).toEqual(sw);
  });

  it("GET ohne year-Param OK (Settings sind nicht jahres-spezifisch)", async () => {
    const res = await authedReq("/api/settings");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2.4: Tests + Commit**
```bash
pnpm test
pnpm typecheck
pnpm lint
git add src/server/routes/settings.ts src/server/index.ts tests/api-settings.integration.test.ts
git commit -m "feat(server): /api/settings (GET/PUT) mit effective-pattern + integration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3+4: UI — API + Hooks + Locales

**Files:**
- Modify: `ui/src/lib/api.ts`
- Create: `ui/src/hooks/{useTrips,useCreateTrip,useUpdateTrip,useDeleteTrip,useSettings,useUpdateSettings,useSyncHolidays}.ts`
- Modify: `ui/src/locales/{de,en}.json`

- [ ] **Step 3.1: API-Client erweitern**

In `ui/src/lib/api.ts`:
```ts
export interface TripDto {
  id: number;
  year: number;
  startDate: string;
  endDate: string;
  uebernachtung: boolean;
}

export interface TripWithDays {
  trip: TripDto;
  days: DayEntryDto[];
}

export interface TripBody {
  startDate: string;
  endDate: string;
  uebernachtung: boolean;
}

export interface Standardwoche {
  mo: boolean; di: boolean; mi: boolean; do: boolean;
  fr: boolean; sa: boolean; so: boolean;
}

export interface EffectiveSettings {
  bundesland: string;
  standardwoche: Standardwoche;
}

export interface UpdateSettingsBody {
  bundesland?: string;
  standardwoche?: Standardwoche;
}
```

In `api`-Objekt:
```ts
listTrips: (year: number) =>
  request<TripWithDays[]>(`/api/trips?year=${year}`),
getTrip: (id: number) =>
  request<TripWithDays>(`/api/trips/${id}`),
createTrip: (body: TripBody) =>
  request<TripWithDays>("/api/trips", {
    method: "POST",
    body: JSON.stringify(body),
  }),
updateTrip: (id: number, body: TripBody) =>
  request<TripWithDays>(`/api/trips/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }),
deleteTrip: (id: number) =>
  request<{ ok: true }>(`/api/trips/${id}`, { method: "DELETE" }),
getSettings: () =>
  request<EffectiveSettings>("/api/settings"),
updateSettings: (body: UpdateSettingsBody) =>
  request<EffectiveSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  }),
```

- [ ] **Step 3.2: Hooks**

Pattern wie 2.B. `useTrips.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useTrips(year: number) {
  return useQuery({
    queryKey: ["trips", year],
    queryFn: () => api.listTrips(year),
  });
}
```

`useCreateTrip.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, ApiError, type TripBody } from "@/lib/api";

export function useCreateTrip(year: number) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (body: TripBody) => api.createTrip(body),
    onError: (err) => {
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        toast.error(t(key, { defaultValue: t("errors.unknown") }));
      } else {
        toast.error(t("errors.network"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["trips", year] });
      void queryClient.invalidateQueries({ queryKey: ["days", year] });
      void queryClient.invalidateQueries({ queryKey: ["summary", year] });
      void queryClient.invalidateQueries({ queryKey: ["checks", year] });
    },
  });
}
```

`useUpdateTrip.ts`: analog, mutationFn `({id, body}) => api.updateTrip(id, body)`.

`useDeleteTrip.ts`: analog, MIT Optimistic Remove pattern (siehe 2.B useDeleteDay als Vorbild — filter trips list + restore on error).

`useSettings.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
}
```

`useUpdateSettings.ts`: useMutation für `api.updateSettings`, invalidiert `["settings"]`. Error-Handling analog.

`useSyncHolidays.ts`: useMutation für `api.syncHolidays(year)`, invalidiert nach Erfolg `["days", year]` + `["summary", year]` + `["checks", year]`.

- [ ] **Step 3.3: Locales-Erweiterung**

DE + EN parallel:
```
pages.reisen.subtitle, pages.einstellungen.subtitle
reisen.new, reisen.edit, reisen.delete
reisen.list.empty
reisen.list.col.start, .end, .tage, .uebernachtung, .summe, .actions
reisen.form.start_date, .end_date, .uebernachtung_label
reisen.form.create_title, .edit_title
reisen.form.save, .cancel
reisen.hart_reset.title, .body, .confirm, .cancel  // mit {{count}} interpolation
reisen.delete_dialog.title, .body, .confirm, .cancel
reisen.toast.created, .updated, .deleted

einstellungen.bundesland_label
einstellungen.standardwoche_label
einstellungen.pauschalen_title
einstellungen.pauschalen.kleine, .grosse, .kuerz_fruehstueck, .kuerz_haupt,
  .homeoffice_pro_tag, .homeoffice_max_tage, .homeoffice_max
einstellungen.save
einstellungen.toast.saved
einstellungen.toast.holidays_synced  // mit {{count}}
einstellungen.toast.holidays_sync_failed
einstellungen.holidays_resync_button

bundeslaender.BB: "Brandenburg", BE: "Berlin", BW: "Baden-Württemberg",
  BY: "Bayern", HB: "Bremen", HE: "Hessen", HH: "Hamburg",
  HE: "Hessen", MV: "Mecklenburg-Vorpommern", NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SH: "Schleswig-Holstein",
  SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt", TH: "Thüringen"
// (16 Bundesländer)

weekdays.mo, .di, .mi, .do, .fr, .sa, .so  // "Montag" etc., länger als kalender.weekday.short

errors.invalid_bundesland_in_settings
errors.invalid_standardwoche
errors.invalid_trip_dates (existiert evtl. schon — sicherstellen)
```

EN analog mit englischen Namen für Bundesländer ("Bavaria" etc.).

- [ ] **Step 3.4: Commit**
```bash
pnpm typecheck:ui
pnpm lint:ui
git add ui/src/lib/api.ts ui/src/hooks/ ui/src/locales/
git commit -m "feat(ui): api-client + hooks erweitert (trips, settings, syncHolidays) + locales

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: ReisenList + ReiseFormDialog + HartResetWarnung

**Files:**
- Create: `ui/src/components/ui/alert-dialog.tsx` (shadcn)
- Create: `ui/src/components/ui/table.tsx` (shadcn)
- Create: `ui/src/components/reisen/ReisenList.tsx`
- Create: `ui/src/components/reisen/ReiseFormDialog.tsx`
- Create: `ui/src/components/reisen/HartResetWarnung.tsx`

- [ ] **Step 5.1: shadcn alert-dialog + table installieren**

```bash
pnpm --filter @reisekontor/ui add @radix-ui/react-alert-dialog
```

Komponenten verbatim aus shadcn-Default (Implementer kennt das Pattern aus T1 Phase 2.B). Hauptexports:
- `alert-dialog.tsx`: AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel
- `table.tsx`: Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption

- [ ] **Step 5.2: ReisenList**

`ui/src/components/reisen/ReisenList.tsx`:
- Card mit `Table` aller Trips des aktuellen Jahres
- Spalten: Startdatum (formatted), Enddatum, # Tage (= `days.length`), Übernachtung (ja/nein), absetzbar (∑ verpflegungProTagCent — frontend-loop via day-styles? Pragmatisch: zeige nur # Tage und Übernachtung, Summe kommt aus Summary), Actions (Edit + Delete Buttons)
- Loading-Skeleton
- Empty-State: "Keine Reisen für {year}"
- "Neue Reise"-Button öffnet ReiseFormDialog im Create-Mode
- Edit-Button öffnet ReiseFormDialog im Edit-Mode mit dem Trip pre-filled
- Delete-Button öffnet ReiseDeleteDialog (in T6 erstellt)

Hooks: `useTrips(year)`, `useYear`.

- [ ] **Step 5.3: ReiseFormDialog**

`ui/src/components/reisen/ReiseFormDialog.tsx`:
- Dialog mit Form
- Felder: startDate (`<Input type="date">`), endDate (`<Input type="date">`), uebernachtung (Checkbox)
- Bei Edit-Mode: pre-fill aus existing Trip
- Auf Submit:
  - Create: `useCreateTrip.mutateAsync`
  - Edit: zuerst prüfen ob HartResetWarnung nötig (count manuelle Mahlzeiten), wenn ja → AlertDialog anzeigen, sonst direkt `useUpdateTrip.mutateAsync`
- Error-Handling via Hook (Toast)
- Schließen bei Erfolg

`countManuelleMahlzeiten(days)` Helper: zählt Day-Entries mit irgendeiner true-Mahlzeit oder zuzahlungCent > 0.

- [ ] **Step 5.4: HartResetWarnung**

`ui/src/components/reisen/HartResetWarnung.tsx`:
- AlertDialog mit Title, Beschreibung (mit `count` interpoliert), Bestätigen / Abbrechen
- Props: `open`, `onOpenChange`, `count`, `onConfirm`

- [ ] **Step 5.5: typecheck + lint + commit**
```bash
pnpm typecheck:ui
pnpm lint:ui
git add ui/src/components/
git commit -m "feat(ui): reisen-list + form-dialog + hart-reset-warnung

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: ReiseDeleteDialog + Reisen-Page Wiring

**Files:**
- Create: `ui/src/components/reisen/ReiseDeleteDialog.tsx`
- Modify: `ui/src/pages/Reisen.tsx`

- [ ] **Step 6.1: ReiseDeleteDialog**

AlertDialog mit "Reise vom {startDate} bis {endDate} wirklich löschen? Alle zugehörigen Tage werden entfernt."

Props: `open`, `onOpenChange`, `trip: TripDto | null`, dann intern `useDeleteTrip.mutateAsync(trip.id)`.

- [ ] **Step 6.2: Reisen-Page Wiring**

`ui/src/pages/Reisen.tsx` (komplett ersetzen):
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReisenList } from "@/components/reisen/ReisenList";
import { ReiseFormDialog } from "@/components/reisen/ReiseFormDialog";
import { ReiseDeleteDialog } from "@/components/reisen/ReiseDeleteDialog";
import { useYear } from "@/contexts/YearContext";
import { YearSelector } from "@/components/uebersicht/YearSelector";
import type { TripWithDays } from "@/lib/api";

export default function Reisen() {
  const { t } = useTranslation();
  const { year } = useYear();
  const [formOpen, setFormOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<TripWithDays | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTrip, setDeleteTrip] = useState<TripWithDays | null>(null);

  function handleCreate() { setEditTrip(null); setFormOpen(true); }
  function handleEdit(trip: TripWithDays) { setEditTrip(trip); setFormOpen(true); }
  function handleDelete(trip: TripWithDays) { setDeleteTrip(trip); setDeleteOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("pages.reisen.title")}</h1>
        <YearSelector />
      </div>

      <ReisenList onCreate={handleCreate} onEdit={handleEdit} onDelete={handleDelete} />

      <ReiseFormDialog open={formOpen} onOpenChange={setFormOpen} editTrip={editTrip} />
      <ReiseDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} trip={deleteTrip?.trip ?? null} />
    </div>
  );
}
```

- [ ] **Step 6.3: typecheck + lint + commit**
```bash
pnpm typecheck:ui
pnpm lint:ui
git add ui/src/components/reisen/ReiseDeleteDialog.tsx ui/src/pages/Reisen.tsx
git commit -m "feat(ui): reise-delete-dialog + reisen-page wiring

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7+8: Settings UI + Einstellungen-Page Wiring

**Files:**
- Create: `ui/src/components/einstellungen/{BundeslandSelect,StandardwocheCheckboxes,PauschalenAnzeige,SettingsForm}.tsx`
- Modify: `ui/src/pages/Einstellungen.tsx`

- [ ] **Step 7.1: BundeslandSelect**

Wrap shadcn Select. Items aus i18n `bundeslaender.{code}` (16 Codes). Value/onChange als Standard-Props.

- [ ] **Step 7.2: StandardwocheCheckboxes**

7 Checkboxes (Mo-So), Labels aus i18n `weekdays.{day}`. State als Standardwoche-Objekt, onChange propagiert.

- [ ] **Step 7.3: PauschalenAnzeige**

Card mit Read-Only-Display der `config.raw.jahre[year]` Werte. Aber: UI hat keinen direkten Zugriff auf config — also Pragmatic via Summary-Endpoint: zeige die Werte aus `useSummary().data.homeofficeMaxTage/homeofficeMaxBetragCent`. Für die Pauschalen kleine_cent/grosse_cent etc. wäre ein neuer Endpoint nötig — pragmatisch hardcoden auf 2026 oder als "kommt in 2.D" platzhalten.

Pragmatischste Lösung: **leerer Platzhalter mit "Pauschalen-Details kommen in Phase 2.D"** — die hardcoded-Werte zu zeigen wäre die schnelle Variante (Anforderungsdok §4.4 listet sie sowieso). Konvention: hardcode für 2026.

Implementer-Entscheidung: zeige die 2026er Werte hardcoded mit Hinweis "Werte für Steuerjahr 2026".

- [ ] **Step 7.4: SettingsForm**

`ui/src/components/einstellungen/SettingsForm.tsx`:
- Hook `useSettings()` lädt aktuelle Werte
- Form-State: bundesland + standardwoche
- Auf Submit:
  - `useUpdateSettings.mutateAsync({bundesland, standardwoche})`
  - Nach Erfolg: `useSyncHolidays.mutateAsync(year)` triggern
  - Toast: kombinierte Nachricht "Einstellungen gespeichert. {created} Feiertage aktualisiert."
- Bei Fehler in Schritt 2: Toast-Warning "Einstellungen gespeichert, Feiertags-Sync fehlgeschlagen"

- [ ] **Step 7.5: Einstellungen-Page Wiring**

`ui/src/pages/Einstellungen.tsx`:
```tsx
import { useTranslation } from "react-i18next";
import { PauschalenAnzeige } from "@/components/einstellungen/PauschalenAnzeige";
import { SettingsForm } from "@/components/einstellungen/SettingsForm";

export default function Einstellungen() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("pages.einstellungen.title")}</h1>
      <SettingsForm />
      <PauschalenAnzeige />
    </div>
  );
}
```

- [ ] **Step 7.6: typecheck + lint + commit**
```bash
pnpm typecheck:ui
pnpm lint:ui
git add ui/src/components/einstellungen/ ui/src/pages/Einstellungen.tsx
git commit -m "feat(ui): settings-form mit bundesland+standardwoche+auto-sync + pauschalen-anzeige

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Smoke + Release 0.7.0

**Files:**
- Modify: `CHANGELOG.md`, root + ui `package.json`

- [ ] **Step 9.1: Live Smoke**

Backend + UI starten, Browser-Test:
1. Reisen-Seite → "Neue Reise" → Datum eingeben → Erstellen → Erscheint in Liste
2. Edit → Datum ändern → Wenn manuelle Mahlzeiten: HartReset-Warnung
3. Delete → Confirmation → Trip + Days weg
4. Einstellungen-Seite → Bundesland-Select → "BY" → Speichern → Toast mit Feiertag-Count
5. Übersicht-Seite öffnen → BY-Feiertage sichtbar im Kalender + Heatmap
6. Standardwoche editieren → Speichern → Toast

Optional curl-Smoke:
```bash
curl -s -X PUT -b cookie.txt -H "Content-Type: application/json" \
  -d '{"bundesland":"BY"}' http://localhost:5174/api/settings
curl -s -b cookie.txt http://localhost:5174/api/settings
```

- [ ] **Step 9.2: CHANGELOG + Versionsbump**

CHANGELOG `[0.7.0] — 2026-06-11`. Auflistung aller Files.

`package.json` (Root) + `ui/package.json`: `"version": "0.6.0"` → `"0.7.0"`.

- [ ] **Step 9.3: Final Smoke**
```bash
pnpm test           # 136 + ~6 settings = ~142
pnpm typecheck
pnpm typecheck:ui
pnpm lint:check
pnpm lint:ui
```

- [ ] **Step 9.4: Release-Commit**
```bash
git add CHANGELOG.md package.json ui/package.json
git commit -m "chore: release 0.7.0 — phase 2.c complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 9.5: git status + log review**

---

## Phase-2.C-Abschluss-Kriterien

- [x] Reisen-CRUD voll funktional im Browser (Tasks 5+6)
- [x] Settings-Form mit Bundesland-Wechsel + auto-syncHolidays (Task 7)
- [x] Pauschalen-Anzeige read-only (Task 7)
- [x] Backend `/api/settings` GET+PUT mit DB-Persistenz (Tasks 1+2)
- [x] ~142 Tests grün (Task 9.3)
- [x] CHANGELOG `[0.7.0]` (Task 9.2)
