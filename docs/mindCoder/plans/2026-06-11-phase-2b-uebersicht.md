# Phase 2.B — Übersicht-Seite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development.

**Goal:** Übersicht-Seite mit YearSelector, 6 KennzahlenCards, PlausibilitaetList, Monatskalender, TagesdetailSheet (CRUD), YearHeatmap. Plus TanStack Query Setup, API-Client erweitert, Sonner-Theme-Fix aus 2.A.

**Architecture:** TanStack Query als Server-State (Query-Keys per `year`), Optimistic Updates für Day-Mutations, eigene Komponenten in `ui/src/components/uebersicht/`, Tagestyp-Farben als Tailwind-Klassen in `lib/day-styles.ts`, CSS-Grid-Heatmap (kein Recharts).

**Tech Stack ergänzt:** @tanstack/react-query, date-fns. Plus shadcn-Komponenten: dialog, sheet, badge, separator, skeleton, checkbox, select, progress, scroll-area.

**Spec:** [2026-06-11-phase-2b-uebersicht-design.md](../specs/2026-06-11-phase-2b-uebersicht-design.md)

**CWD:** `c:\Projekte\Reisen\reisekontor`

---

## Task 1: Setup — Dependencies + Lib-Helpers + shadcn-Komponenten

**Files:**
- Modify: `ui/package.json` (Deps)
- Create: `ui/src/lib/{day-styles.ts, money-format.ts, query-client.ts}`
- Create: shadcn components: `ui/src/components/ui/{dialog,sheet,badge,separator,skeleton,checkbox,select,progress,scroll-area}.tsx`

- [ ] **Step 1.1: Dependencies installieren**

```bash
pnpm --filter @reisekontor/ui add @tanstack/react-query date-fns
pnpm --filter @reisekontor/ui add @radix-ui/react-dialog @radix-ui/react-checkbox @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-progress @radix-ui/react-scroll-area
```

- [ ] **Step 1.2: Helpers**

`ui/src/lib/day-styles.ts`:
```ts
import type { DayType } from "./api";

export const DAY_TYPE_LABELS_DE: Record<DayType, string> = {
  homeoffice: "Homeoffice",
  buero: "Büro",
  reise_anreise: "Reise – Anreise",
  reise_voll: "Reise – voller Tag",
  reise_abreise: "Reise – Abreise",
  reise_eintaegig: "Reise – eintägig",
  urlaub: "Urlaub",
  krankheit: "Krankheit",
  feiertag: "Feiertag",
};

const COLORS: Record<DayType, string> = {
  homeoffice: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  buero: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  reise_anreise: "bg-orange-500/30 text-orange-300 border-orange-500/50",
  reise_voll: "bg-red-500/30 text-red-300 border-red-500/50",
  reise_abreise: "bg-orange-500/30 text-orange-300 border-orange-500/50",
  reise_eintaegig: "bg-amber-500/30 text-amber-300 border-amber-500/50",
  urlaub: "bg-green-500/20 text-green-300 border-green-500/40",
  krankheit: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  feiertag: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

export function dayTypeClasses(type: DayType | null): string {
  if (!type) return "border-border bg-transparent text-muted-foreground";
  return COLORS[type] ?? "";
}

export const REISE_TYPES: ReadonlyArray<DayType> = [
  "reise_anreise",
  "reise_voll",
  "reise_abreise",
  "reise_eintaegig",
];

export function isReiseType(type: DayType): boolean {
  return REISE_TYPES.includes(type);
}
```

`ui/src/lib/money-format.ts`:
```ts
const formatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(cent: number): string {
  return formatter.format(cent / 100).replace(/[  ]/g, " ");
}
```

`ui/src/lib/query-client.ts`:
```ts
import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./api";

export function createQueryClient(onUnauthorized: () => void): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
```

- [ ] **Step 1.3: shadcn-Komponenten kopieren**

Alle 9 Komponenten aus dem shadcn-Default-Style. Statt jeden Code inline zu pasten, der Subagent kopiert sie aus dem aktuellen shadcn-Registry (oder von den vorhandenen 2.A-Komponenten ableitend). Wichtig: alle nutzen `@/lib/utils` (cn) und folgen dem gleichen forwardRef-Pattern.

Falls die `pnpm dlx shadcn@latest add ...` Interaktion zu viele Eingaben fordert: manuell schreiben gemäß shadcn-Docs (https://ui.shadcn.com/docs/components). Jede Datei `~50-150 LoC`.

Liste der Files (Pfad: `ui/src/components/ui/`):
- `dialog.tsx`
- `sheet.tsx`
- `badge.tsx`
- `separator.tsx`
- `skeleton.tsx`
- `checkbox.tsx`
- `select.tsx`
- `progress.tsx`
- `scroll-area.tsx`

- [ ] **Step 1.4: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/
git commit -m "feat(ui): tanstack-query + date-fns + 9 shadcn-komponenten + lib-helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: API-Client erweitern + Sonner-Theme-Fix

**Files:**
- Modify: `ui/src/lib/api.ts`
- Create: `ui/src/hooks/useResolvedTheme.ts`
- Modify: `ui/src/components/ui/sonner.tsx`

- [ ] **Step 2.1: API-Client erweitern**

`ui/src/lib/api.ts` ergänzen um Types und Endpoints:

```ts
export type DayType =
  | "homeoffice" | "buero"
  | "reise_anreise" | "reise_voll" | "reise_abreise" | "reise_eintaegig"
  | "urlaub" | "krankheit" | "feiertag";

export interface DayEntryDto {
  date: string;
  year: number;
  type: DayType;
  homeoffice: boolean;
  tripId: number | null;
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungCent: number;
}

export interface YearSummary {
  year: number;
  verpflegungSummeCent: number;
  kuerzungSummeCent: number;
  homeofficeTage: number;
  homeofficeMaxTage: number;
  homeofficeBetragCent: number;
  homeofficeMaxBetragCent: number;
  reisetageNachTyp: Record<"reise_anreise" | "reise_voll" | "reise_abreise" | "reise_eintaegig", number>;
  reisenAnzahl: number;
}

export type PlausibilitaetCode =
  | "DOPPEL_HO_REISE_VOLL"
  | "EINTAEGIG_8H_BESTAETIGEN"
  | "HO_KONFLIKT_ENTFERNUNG";

export interface PlausibilitaetHinweis {
  code: PlausibilitaetCode;
  date: string;
  schwere: "hinweis" | "warnung";
}

export interface UpsertDayBody {
  type: DayType;
  homeoffice?: boolean;
  tripId?: number | null;
  meals?: { fruehstueck?: boolean; mittag?: boolean; abend?: boolean };
  zuzahlungCent?: number;
}

export interface HolidaysSyncResult {
  year: number;
  bundesland: string;
  created: number;
  skipped: Array<{ date: string; existingType: string }>;
}
```

Im `api`-Objekt anhängen:
```ts
listDays: (year: number) =>
  request<DayEntryDto[]>(`/api/days?year=${year}`),
upsertDay: (date: string, body: UpsertDayBody) =>
  request<{ ok: true; created: boolean }>(`/api/days/${date}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }),
deleteDay: (date: string) =>
  request<{ ok: true }>(`/api/days/${date}`, { method: "DELETE" }),
getSummary: (year: number) =>
  request<YearSummary>(`/api/summary?year=${year}`),
getChecks: (year: number) =>
  request<PlausibilitaetHinweis[]>(`/api/checks?year=${year}`),
syncHolidays: (year: number) =>
  request<HolidaysSyncResult>(`/api/holidays/sync?year=${year}`, { method: "POST" }),
```

- [ ] **Step 2.2: useResolvedTheme Hook**

`ui/src/hooks/useResolvedTheme.ts`:
```ts
import { useEffect, useState } from "react";

export type ResolvedTheme = "dark" | "light";

function readTheme(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
```

- [ ] **Step 2.3: Sonner-Komponente anpassen**

`ui/src/components/ui/sonner.tsx` — ersetze `theme="system"` mit `theme={useResolvedTheme()}`:

```tsx
import { Toaster as Sonner } from "sonner";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useResolvedTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{ /* unchanged */ }}
      {...props}
    />
  );
};

export { Toaster };
```

- [ ] **Step 2.4: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/lib/api.ts ui/src/hooks/useResolvedTheme.ts ui/src/components/ui/sonner.tsx
git commit -m "feat(ui): api-client erweitern (days/summary/checks/holidays) + sonner-theme-fix

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: YearContext + YearSelector + Query-Hooks

**Files:**
- Create: `ui/src/contexts/YearContext.tsx`
- Create: `ui/src/components/uebersicht/YearSelector.tsx`
- Create: `ui/src/hooks/{useDays, useSummary, useChecks, useUpsertDay, useDeleteDay}.ts`
- Modify: `ui/src/main.tsx` (QueryClientProvider + YearProvider einhängen)

- [ ] **Step 3.1: YearContext**

`ui/src/contexts/YearContext.tsx`:
```tsx
import { createContext, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "rk-year";
const CURRENT_YEAR = 2026; // wird in main.tsx initialisiert

interface YearContextValue {
  year: number;
  setYear: (y: number) => void;
}

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number.parseInt(stored, 10);
      if (Number.isFinite(n) && n >= 2020 && n <= 2100) return n;
    }
    return CURRENT_YEAR;
  });

  function setYear(y: number) {
    localStorage.setItem(STORAGE_KEY, String(y));
    setYearState(y);
  }

  return <YearContext.Provider value={{ year, setYear }}>{children}</YearContext.Provider>;
}

export function useYear(): YearContextValue {
  const v = useContext(YearContext);
  if (!v) throw new Error("useYear muss innerhalb YearProvider gerufen werden");
  return v;
}
```

- [ ] **Step 3.2: YearSelector**

`ui/src/components/uebersicht/YearSelector.tsx`:
```tsx
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYear } from "@/contexts/YearContext";

const AVAILABLE_YEARS = [2024, 2025, 2026];

export function YearSelector() {
  const { t } = useTranslation();
  const { year, setYear } = useYear();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground">{t("year_selector.label")}</label>
      <Select value={String(year)} onValueChange={(v) => setYear(Number.parseInt(v, 10))}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3.3: Query-Hooks**

`ui/src/hooks/useDays.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDays(year: number) {
  return useQuery({
    queryKey: ["days", year],
    queryFn: () => api.listDays(year),
  });
}
```

Analog `useSummary.ts`, `useChecks.ts` für `api.getSummary` / `api.getChecks`.

`ui/src/hooks/useUpsertDay.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api, ApiError, type DayEntryDto, type UpsertDayBody } from "@/lib/api";

export function useUpsertDay(year: number) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ date, body }: { date: string; body: UpsertDayBody }) =>
      api.upsertDay(date, body),
    onMutate: async ({ date, body }) => {
      await queryClient.cancelQueries({ queryKey: ["days", year] });
      const previous = queryClient.getQueryData<DayEntryDto[]>(["days", year]);
      const optimistic: DayEntryDto = {
        date,
        year,
        type: body.type,
        homeoffice: body.homeoffice ?? false,
        tripId: body.tripId ?? null,
        fruehstueck: body.meals?.fruehstueck ?? false,
        mittag: body.meals?.mittag ?? false,
        abend: body.meals?.abend ?? false,
        zuzahlungCent: body.zuzahlungCent ?? 0,
      };
      queryClient.setQueryData<DayEntryDto[]>(["days", year], (old) => {
        if (!old) return [optimistic];
        const i = old.findIndex((d) => d.date === date);
        if (i >= 0) {
          const copy = [...old];
          copy[i] = { ...copy[i], ...optimistic };
          return copy;
        }
        return [...old, optimistic];
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["days", year], ctx.previous);
      }
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        const msg = t(key, { defaultValue: t("errors.unknown") });
        toast.error(msg);
      } else {
        toast.error(t("errors.network"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["days", year] });
      void queryClient.invalidateQueries({ queryKey: ["summary", year] });
      void queryClient.invalidateQueries({ queryKey: ["checks", year] });
    },
  });
}
```

`ui/src/hooks/useDeleteDay.ts`: analog mit `api.deleteDay`, ohne Optimistic-Add (nur Optimistic-Remove).

- [ ] **Step 3.4: main.tsx erweitern**

`ui/src/main.tsx`:
```tsx
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n.ts";
import { YearProvider } from "./contexts/YearContext.tsx";
import { createQueryClient } from "./lib/query-client.ts";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");

const queryClient = createQueryClient(() => {
  // QueryClient-Level Auth-Redirect: bei 401 zur Login-Seite
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Suspense fallback={<div className="p-8">…</div>}>
      <QueryClientProvider client={queryClient}>
        <YearProvider>
          <App />
        </YearProvider>
      </QueryClientProvider>
    </Suspense>
  </React.StrictMode>,
);
```

- [ ] **Step 3.5: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/contexts/ ui/src/components/uebersicht/ ui/src/hooks/ ui/src/main.tsx
git commit -m "feat(ui): year-context + selector + tanstack-query hooks (useDays/Summary/Checks/UpsertDay/DeleteDay)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: KennzahlenCards

**Files:**
- Create: `ui/src/components/uebersicht/KennzahlenCards.tsx`

- [ ] **Step 4.1: Komponente**

`ui/src/components/uebersicht/KennzahlenCards.tsx`:
```tsx
import { useTranslation } from "react-i18next";
import { Briefcase, Home, Plane, Receipt, Scissors, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSummary } from "@/hooks/useSummary";
import { useYear } from "@/contexts/YearContext";
import { formatEur } from "@/lib/money-format";

function Cell({
  icon,
  title,
  value,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {value !== undefined && <div className="text-2xl font-bold">{value}</div>}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

export function KennzahlenCards() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data, isLoading } = useSummary(year);

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const reisetageGesamt = Object.values(data.reisetageNachTyp).reduce((a, b) => a + b, 0);
  const hoPct = data.homeofficeMaxTage > 0
    ? Math.round((data.homeofficeTage / data.homeofficeMaxTage) * 100)
    : 0;
  const hoEurPct = data.homeofficeMaxBetragCent > 0
    ? Math.round((data.homeofficeBetragCent / data.homeofficeMaxBetragCent) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Cell
        icon={<Receipt className="h-4 w-4" />}
        title={t("kennzahlen.verpflegung.label")}
        value={formatEur(data.verpflegungSummeCent)}
        subtitle={t("kennzahlen.verpflegung.subtitle")}
      />
      <Cell
        icon={<Scissors className="h-4 w-4" />}
        title={t("kennzahlen.kuerzung.label")}
        value={formatEur(data.kuerzungSummeCent)}
        subtitle={t("kennzahlen.kuerzung.subtitle")}
      />
      <Cell
        icon={<Home className="h-4 w-4" />}
        title={t("kennzahlen.homeoffice_tage.label")}
      >
        <div className="text-2xl font-bold">
          {data.homeofficeTage} / {data.homeofficeMaxTage}
        </div>
        <Progress value={hoPct} className="mt-2" />
      </Cell>
      <Cell
        icon={<TrendingUp className="h-4 w-4" />}
        title={t("kennzahlen.homeoffice_betrag.label")}
      >
        <div className="text-2xl font-bold">{formatEur(data.homeofficeBetragCent)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {t("kennzahlen.homeoffice_betrag.subtitle", {
            max: formatEur(data.homeofficeMaxBetragCent),
          })}
        </p>
        <Progress value={hoEurPct} className="mt-2" />
      </Cell>
      <Cell
        icon={<Plane className="h-4 w-4" />}
        title={t("kennzahlen.reisen_anzahl.label")}
        value={String(data.reisenAnzahl)}
        subtitle={t("kennzahlen.reisen_anzahl.subtitle")}
      />
      <Cell
        icon={<Briefcase className="h-4 w-4" />}
        title={t("kennzahlen.reisetage_gesamt.label")}
        value={String(reisetageGesamt)}
        subtitle={t("kennzahlen.reisetage_gesamt.subtitle", {
          anreise: data.reisetageNachTyp.reise_anreise,
          voll: data.reisetageNachTyp.reise_voll,
          abreise: data.reisetageNachTyp.reise_abreise,
          eintaegig: data.reisetageNachTyp.reise_eintaegig,
        })}
      />
    </div>
  );
}
```

- [ ] **Step 4.2: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/components/uebersicht/KennzahlenCards.tsx
git commit -m "feat(ui): kennzahlen-cards mit 6 metriken aus /api/summary

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: PlausibilitaetList + Locales-Erweiterung

**Files:**
- Create: `ui/src/components/uebersicht/PlausibilitaetList.tsx`
- Modify: `ui/src/locales/{de,en}.json` (alle neuen Keys ergänzen)

- [ ] **Step 5.1: Locales erweitern (DE + EN parallel)**

`de.json` ergänzen — die Original-2.A-Keys behalten, die Liste aus Spec §5 hinzufügen. Beispiele:

```json
{
  "year_selector.label": "Jahr",

  "day_types.homeoffice": "Homeoffice",
  "day_types.buero": "Büro",
  "day_types.reise_anreise": "Reise – Anreise",
  "day_types.reise_voll": "Reise – voller Tag",
  "day_types.reise_abreise": "Reise – Abreise",
  "day_types.reise_eintaegig": "Reise – eintägig",
  "day_types.urlaub": "Urlaub",
  "day_types.krankheit": "Krankheit",
  "day_types.feiertag": "Feiertag",
  "day_types.kein_eintrag": "Kein Eintrag",

  "meals.fruehstueck": "Frühstück",
  "meals.mittag": "Mittag",
  "meals.abend": "Abend",

  "checks.codes.DOPPEL_HO_REISE_VOLL": "Dieser Tag ist als voller Reisetag erfasst, aber gleichzeitig als Homeoffice. Bitte korrigieren.",
  "checks.codes.EINTAEGIG_8H_BESTAETIGEN": "Eintägige Reise – bitte > 8 h Abwesenheit bestätigen.",
  "checks.codes.HO_KONFLIKT_ENTFERNUNG": "Mögliche Kollision Homeoffice-Pauschale ↔ Entfernungspauschale.",
  "checks.empty": "Keine offenen Hinweise.",
  "checks.title": "Hinweise",

  "kennzahlen.verpflegung.label": "Verpflegung",
  "kennzahlen.verpflegung.subtitle": "Absetzbarer Mehraufwand",
  "kennzahlen.kuerzung.label": "Mahlzeiten-Kürzung",
  "kennzahlen.kuerzung.subtitle": "Summe der Kürzungen",
  "kennzahlen.homeoffice_tage.label": "Homeoffice-Tage",
  "kennzahlen.homeoffice_betrag.label": "Homeoffice-Pauschale",
  "kennzahlen.homeoffice_betrag.subtitle": "Max. {{max}}",
  "kennzahlen.reisen_anzahl.label": "Reisen",
  "kennzahlen.reisen_anzahl.subtitle": "Anzahl Vorgänge",
  "kennzahlen.reisetage_gesamt.label": "Reisetage",
  "kennzahlen.reisetage_gesamt.subtitle": "An: {{anreise}}, V: {{voll}}, Ab: {{abreise}}, Ein: {{eintaegig}}",

  "tagesdetail.title_with_date": "{{date}}",
  "tagesdetail.type_label": "Tagestyp",
  "tagesdetail.meals_label": "Gestellte Mahlzeiten",
  "tagesdetail.zuzahlung_label": "Zuzahlung (€)",
  "tagesdetail.homeoffice_combo_label": "Zusätzlich Homeoffice",
  "tagesdetail.save": "Speichern",
  "tagesdetail.delete": "Löschen",
  "tagesdetail.cancel": "Abbrechen",
  "tagesdetail.trip_locked_hint": "Reise-Tag — Typ wird über die Reisen-Seite gesteuert.",
  "tagesdetail.saved": "Tag gespeichert",
  "tagesdetail.deleted": "Tag gelöscht",

  "kalender.prev_month": "Vorheriger Monat",
  "kalender.next_month": "Nächster Monat",
  "kalender.weekday.short.mo": "Mo",
  "kalender.weekday.short.di": "Di",
  "kalender.weekday.short.mi": "Mi",
  "kalender.weekday.short.do": "Do",
  "kalender.weekday.short.fr": "Fr",
  "kalender.weekday.short.sa": "Sa",
  "kalender.weekday.short.so": "So",

  "heatmap.title": "Jahresübersicht",

  "errors.invalid_query": "Ungültige Anfrage.",
  "errors.year_not_configured": "Für dieses Jahr sind keine Sätze hinterlegt.",
  "errors.reise_type_via_trips": "Reisetage werden über die Reisen-Seite angelegt.",
  "errors.type_locked_for_trip_day": "Der Typ eines Reisetags kann hier nicht geändert werden.",
  "errors.trip_id_locked": "Die Reise-Zuordnung kann hier nicht geändert werden.",
  "errors.reise_day_via_trip": "Reisetage werden über die Reisen-Seite gelöscht.",
  "errors.date_conflict": "Datum bereits vergeben.",
  "errors.internal_error": "Interner Fehler. Bitte erneut versuchen.",

  "pages.uebersicht.placeholder": "..."
}
```

(Den `pages.uebersicht.placeholder`-Key behalten oder entfernen — die Seite wird in T9 ersetzt, der Key wird obsolet.)

`en.json` mit denselben Keys, englische Werte. Beispiel:
```json
{
  "year_selector.label": "Year",
  "day_types.homeoffice": "Home office",
  "...": "..."
}
```

- [ ] **Step 5.2: PlausibilitaetList**

`ui/src/components/uebersicht/PlausibilitaetList.tsx`:
```tsx
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useChecks } from "@/hooks/useChecks";
import { useYear } from "@/contexts/YearContext";

const SCHWERE_ORDER: Record<"warnung" | "hinweis", number> = { warnung: 0, hinweis: 1 };

export function PlausibilitaetList() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data, isLoading } = useChecks(year);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("checks.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("checks.empty")}</p>
        ) : (
          <ScrollArea className="max-h-72">
            <ul className="space-y-2">
              {[...data]
                .sort(
                  (a, b) =>
                    SCHWERE_ORDER[a.schwere] - SCHWERE_ORDER[b.schwere] ||
                    a.date.localeCompare(b.date),
                )
                .map((h, i) => (
                  <li key={`${h.code}-${h.date}-${i}`} className="flex items-start gap-2 text-sm">
                    {h.schwere === "warnung" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 text-amber-500" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={h.schwere === "warnung" ? "destructive" : "secondary"}>
                          {h.date}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{t(`checks.codes.${h.code}`)}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.3: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/locales/ ui/src/components/uebersicht/PlausibilitaetList.tsx
git commit -m "feat(ui): plausibilitaet-list + locales-erweiterung für 2.B

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Monatskalender

**Files:**
- Create: `ui/src/components/uebersicht/Monatskalender.tsx`

- [ ] **Step 6.1: Komponente**

`ui/src/components/uebersicht/Monatskalender.tsx`:
```tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DayEntryDto } from "@/lib/api";
import { dayTypeClasses } from "@/lib/day-styles";
import { cn } from "@/lib/utils";

interface Props {
  year: number;
  month: number; // 1-12
  days: DayEntryDto[];
  onMonthChange: (year: number, month: number) => void;
  onDayClick: (iso: string) => void;
  selectedDate?: string;
}

export function Monatskalender({ year, month, days, onMonthChange, onDayClick, selectedDate }: Props) {
  const { t } = useTranslation();
  const cursor = new Date(year, month - 1, 1);

  const dayByIso = useMemo(() => {
    const map = new Map<string, DayEntryDto>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Montag
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  function nav(deltaMonths: number) {
    const next = addMonths(cursor, deltaMonths);
    onMonthChange(next.getFullYear(), next.getMonth() + 1);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label={t("kalender.prev_month")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{format(cursor, "MMMM yyyy", { locale: de })}</h2>
        <Button variant="ghost" size="icon" onClick={() => nav(1)} aria-label={t("kalender.next_month")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-muted-foreground">
        {(["mo", "di", "mi", "do", "fr", "sa", "so"] as const).map((d) => (
          <div key={d} className="text-center py-1">
            {t(`kalender.weekday.short.${d}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, cursor);
          const entry = dayByIso.get(iso);
          const isSelected = selectedDate === iso;
          const isKombi =
            entry?.homeoffice && (entry.type === "reise_anreise" || entry.type === "reise_abreise");
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDayClick(iso)}
              className={cn(
                "relative aspect-square rounded border text-sm transition-all",
                "hover:ring-2 hover:ring-ring",
                dayTypeClasses(entry?.type ?? null),
                !inMonth && "opacity-40",
                isSelected && "ring-2 ring-ring",
              )}
              aria-label={iso}
            >
              <span className="absolute top-1 left-2 text-xs font-medium">
                {format(d, "d")}
              </span>
              {isKombi && (
                <Home className="absolute bottom-1 right-1 h-3 w-3 text-blue-300" aria-label="Kombi-Tag" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/components/uebersicht/Monatskalender.tsx
git commit -m "feat(ui): monatskalender mit tagestyp-farben + kombi-badge + prev/next-navigation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: TagesdetailSheet

**Files:**
- Create: `ui/src/components/uebersicht/TagesdetailSheet.tsx`

- [ ] **Step 7.1: Komponente**

`ui/src/components/uebersicht/TagesdetailSheet.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DayEntryDto, DayType } from "@/lib/api";
import { isReiseType } from "@/lib/day-styles";
import { useDeleteDay } from "@/hooks/useDeleteDay";
import { useUpsertDay } from "@/hooks/useUpsertDay";
import { useYear } from "@/contexts/YearContext";

const NON_REISE_TYPES: DayType[] = ["homeoffice", "buero", "urlaub", "krankheit", "feiertag"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  existing: DayEntryDto | null;
}

export function TagesdetailSheet({ open, onOpenChange, date, existing }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const upsert = useUpsertDay(year);
  const del = useDeleteDay(year);

  const [type, setType] = useState<DayType>("homeoffice");
  const [homeoffice, setHomeoffice] = useState(false);
  const [fruehstueck, setFruehstueck] = useState(false);
  const [mittag, setMittag] = useState(false);
  const [abend, setAbend] = useState(false);
  const [zuzahlungEur, setZuzahlungEur] = useState("0,00");

  // Beim Öffnen / Datum-Wechsel State aus existing setzen
  useEffect(() => {
    if (!open || !date) return;
    if (existing) {
      setType(existing.type);
      setHomeoffice(existing.homeoffice);
      setFruehstueck(existing.fruehstueck);
      setMittag(existing.mittag);
      setAbend(existing.abend);
      setZuzahlungEur((existing.zuzahlungCent / 100).toFixed(2).replace(".", ","));
    } else {
      setType("homeoffice");
      setHomeoffice(false);
      setFruehstueck(false);
      setMittag(false);
      setAbend(false);
      setZuzahlungEur("0,00");
    }
  }, [open, date, existing]);

  if (!date) return null;

  const isTripDay = existing?.tripId !== null && existing?.tripId !== undefined;
  const showMealsAndHo = isReiseType(type);

  async function handleSave() {
    if (!date) return;
    const zuzahlungCent = Math.round(Number.parseFloat(zuzahlungEur.replace(",", ".") || "0") * 100);
    try {
      await upsert.mutateAsync({
        date,
        body: {
          type,
          homeoffice: isReiseType(type) ? homeoffice : false,
          tripId: existing?.tripId ?? null,
          meals: isReiseType(type)
            ? { fruehstueck, mittag, abend }
            : { fruehstueck: false, mittag: false, abend: false },
          zuzahlungCent: isReiseType(type) ? zuzahlungCent : 0,
        },
      });
      toast.success(t("tagesdetail.saved"));
      onOpenChange(false);
    } catch {
      // Fehler wurde in useUpsertDay.onError als Toast angezeigt
    }
  }

  async function handleDelete() {
    if (!date) return;
    try {
      await del.mutateAsync(date);
      toast.success(t("tagesdetail.deleted"));
      onOpenChange(false);
    } catch {
      // ditto
    }
  }

  const dateDisplay = format(new Date(date), "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{dateDisplay}</SheetTitle>
          {isTripDay && (
            <SheetDescription className="text-amber-500">
              {t("tagesdetail.trip_locked_hint")}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("tagesdetail.type_label")}</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as DayType)}
              disabled={isTripDay}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NON_REISE_TYPES.map((tt) => (
                  <SelectItem key={tt} value={tt}>
                    {t(`day_types.${tt}`)}
                  </SelectItem>
                ))}
                {isTripDay && (
                  <>
                    <SelectItem value="reise_anreise">{t("day_types.reise_anreise")}</SelectItem>
                    <SelectItem value="reise_voll">{t("day_types.reise_voll")}</SelectItem>
                    <SelectItem value="reise_abreise">{t("day_types.reise_abreise")}</SelectItem>
                    <SelectItem value="reise_eintaegig">{t("day_types.reise_eintaegig")}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {showMealsAndHo && (
            <>
              {(type === "reise_anreise" || type === "reise_abreise") && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="homeoffice"
                    checked={homeoffice}
                    onCheckedChange={(c) => setHomeoffice(c === true)}
                  />
                  <Label htmlFor="homeoffice">{t("tagesdetail.homeoffice_combo_label")}</Label>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("tagesdetail.meals_label")}</Label>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fruehstueck"
                      checked={fruehstueck}
                      onCheckedChange={(c) => setFruehstueck(c === true)}
                    />
                    <Label htmlFor="fruehstueck">{t("meals.fruehstueck")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mittag"
                      checked={mittag}
                      onCheckedChange={(c) => setMittag(c === true)}
                    />
                    <Label htmlFor="mittag">{t("meals.mittag")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="abend"
                      checked={abend}
                      onCheckedChange={(c) => setAbend(c === true)}
                    />
                    <Label htmlFor="abend">{t("meals.abend")}</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zuzahlung">{t("tagesdetail.zuzahlung_label")}</Label>
                <Input
                  id="zuzahlung"
                  type="text"
                  inputMode="decimal"
                  value={zuzahlungEur}
                  onChange={(e) => setZuzahlungEur(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {t("tagesdetail.save")}
            </Button>
            {existing && !isTripDay && (
              <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
                {t("tagesdetail.delete")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("tagesdetail.cancel")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 7.2: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/components/uebersicht/TagesdetailSheet.tsx
git commit -m "feat(ui): tagesdetail-sheet mit form + optimistic upsert/delete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: YearHeatmap

**Files:**
- Create: `ui/src/components/uebersicht/YearHeatmap.tsx`

- [ ] **Step 8.1: Komponente**

`ui/src/components/uebersicht/YearHeatmap.tsx`:
```tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayEntryDto } from "@/lib/api";
import { dayTypeClasses } from "@/lib/day-styles";
import { cn } from "@/lib/utils";

interface Props {
  year: number;
  days: DayEntryDto[];
  isLoading: boolean;
  onDayClick: (iso: string) => void;
}

const MONTHS = [
  "januar", "februar", "maerz", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "dezember",
] as const;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function YearHeatmap({ year, days, isLoading, onDayClick }: Props) {
  const { t } = useTranslation();

  const dayByIso = useMemo(() => {
    const map = new Map<string, DayEntryDto>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("heatmap.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("heatmap.title")} {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {Array.from({ length: 12 }, (_, m) => m + 1).map((month) => {
            const dim = daysInMonth(year, month);
            const monthDate = new Date(year, month - 1, 1);
            return (
              <div key={month} className="flex items-center gap-2">
                <span className="w-12 text-xs text-muted-foreground shrink-0">
                  {format(monthDate, "MMM", { locale: de })}
                </span>
                <div className="flex gap-0.5 flex-wrap">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    if (day > dim) {
                      return <div key={day} className="w-4 h-4 opacity-0" />;
                    }
                    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const entry = dayByIso.get(iso);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onDayClick(iso)}
                        title={`${iso}${entry ? ` — ${t(`day_types.${entry.type}`)}` : ""}`}
                        className={cn(
                          "w-4 h-4 rounded-sm border transition-all hover:ring-1 hover:ring-ring",
                          dayTypeClasses(entry?.type ?? null),
                        )}
                        aria-label={iso}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

(`MONTHS`-Array bleibt für mögliche spätere Erweiterung, wird aktuell nicht genutzt — entferne ggf. wenn der Lint mosert.)

- [ ] **Step 8.2: typecheck + commit**

```bash
pnpm typecheck:ui
git add ui/src/components/uebersicht/YearHeatmap.tsx
git commit -m "feat(ui): year-heatmap als css-grid mit tagestyp-farben

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Übersicht-Page Wiring

**Files:**
- Modify: `ui/src/pages/Uebersicht.tsx`

- [ ] **Step 9.1: Echte Seite implementieren**

`ui/src/pages/Uebersicht.tsx` (komplett ersetzen):
```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useYear } from "@/contexts/YearContext";
import { useDays } from "@/hooks/useDays";
import { KennzahlenCards } from "@/components/uebersicht/KennzahlenCards";
import { Monatskalender } from "@/components/uebersicht/Monatskalender";
import { PlausibilitaetList } from "@/components/uebersicht/PlausibilitaetList";
import { TagesdetailSheet } from "@/components/uebersicht/TagesdetailSheet";
import { YearHeatmap } from "@/components/uebersicht/YearHeatmap";
import { YearSelector } from "@/components/uebersicht/YearSelector";

export default function Uebersicht() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data: days, isLoading } = useDays(year);

  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const existing = days?.find((d) => d.date === selectedDate) ?? null;

  function handleDayClick(iso: string) {
    setSelectedDate(iso);
    // Falls Klick aus Heatmap: zum Monat springen
    const [y, m] = iso.split("-").map((s) => Number.parseInt(s, 10));
    if (y && m && (y !== year || m !== month)) {
      setMonth(m);
    }
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("pages.uebersicht.title")}</h1>
        <YearSelector />
      </div>

      <KennzahlenCards />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Monatskalender
            year={year}
            month={month}
            days={days ?? []}
            onMonthChange={(_, m) => setMonth(m)}
            onDayClick={handleDayClick}
            {...(selectedDate ? { selectedDate } : {})}
          />
        </div>
        <div>
          <PlausibilitaetList />
        </div>
      </div>

      <YearHeatmap
        year={year}
        days={days ?? []}
        isLoading={isLoading}
        onDayClick={handleDayClick}
      />

      <TagesdetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        date={selectedDate}
        existing={existing}
      />
    </div>
  );
}
```

- [ ] **Step 9.2: typecheck + build verifizieren**

```bash
pnpm typecheck:ui
pnpm build:ui
pnpm lint:ui
```

Alle exit 0. Build produziert `ui/dist/` ohne Fehler.

- [ ] **Step 9.3: Commit**

```bash
git add ui/src/pages/Uebersicht.tsx
git commit -m "feat(ui): übersicht-page mit allen 2.b-komponenten verdrahtet

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Smoke + Release 0.6.0

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (Root) + `ui/package.json` (Version)

- [ ] **Step 10.1: Manueller Browser-Smoke**

Terminal 1: `pnpm dev` (Backend). Terminal 2: `pnpm dev:ui` (Vite).

Im Browser `http://localhost:5174`:
1. Login `test123` → Übersicht
2. YearSelector zeigt 2026 (oder gespeicherten Wert)
3. Kennzahlen-Karten zeigen leere Werte (DB ist evtl. leer) — keine Crashes
4. POST `/api/holidays/sync?year=2026` ausführen (über DevTools oder Postman, weil noch kein UI-Button); reload → Feiertage erscheinen lila im Kalender
5. Klick auf einen Werktag → Sheet öffnet, Typ `homeoffice` setzen, Speichern → Kalender-Zelle wird blau (Optimistic) → Kennzahlen + Heatmap aktualisieren
6. Klick auf den gleichen Tag → Typ `urlaub`, Speichern → grün
7. Plausi-Hinweise: nach Setzen mehrerer Homeoffice-Tage → HO_KONFLIKT_ENTFERNUNG-Hinweise erscheinen
8. Klick auf Heatmap-Zelle → Monatskalender springt → Sheet öffnet sich
9. Theme + Sprache wechseln → alle Strings + Toasts wechseln
10. Logout

Falls etwas crasht: DevTools Console + Server-Logs prüfen, fixen, weiter.

- [ ] **Step 10.2: CHANGELOG + Versionsbump**

In `CHANGELOG.md` über `## [0.5.0]` einfügen:
```markdown
## [Unreleased]

## [0.6.0] — 2026-06-11

### Added
- `ui/src/contexts/YearContext.tsx` — globales aktives Steuerjahr, persistiert in `localStorage['rk-year']`.
- TanStack Query als Server-State (`QueryClientProvider` in `main.tsx`).
- API-Client um `listDays`, `upsertDay`, `deleteDay`, `getSummary`, `getChecks`, `syncHolidays` erweitert.
- 9 shadcn-Komponenten ergänzt: dialog, sheet, badge, separator, skeleton, checkbox, select, progress, scroll-area.
- `ui/src/lib/day-styles.ts` — Tagestyp-Farben als Tailwind-Klassen + Labels.
- `ui/src/lib/money-format.ts` — `formatEur(cent)` für UI.
- `ui/src/lib/query-client.ts` — QueryClient-Factory mit Auth-Redirect bei 401.
- `ui/src/hooks/{useDays,useSummary,useChecks,useUpsertDay,useDeleteDay,useResolvedTheme}.ts`.
- `ui/src/components/uebersicht/{YearSelector,KennzahlenCards,PlausibilitaetList,Monatskalender,TagesdetailSheet,YearHeatmap}.tsx`.
- `ui/src/pages/Uebersicht.tsx` als echte Übersicht-Seite (Kalender als Mittelpunkt, Kennzahlen-Karten, Plausi-Hinweise, Heatmap).
- date-fns + de-Locale für Datums-Math.

### Changed
- `ui/src/components/ui/sonner.tsx` — Theme jetzt aus `rk-theme` abgeleitet (statt OS-system), via `useResolvedTheme`-Hook mit MutationObserver.
- `package.json` + `ui/package.json` — Version 0.6.0.
- Locales `de.json` + `en.json` — ~50 neue Keys (Tagestypen, Mahlzeiten, Checks-Codes, Kennzahlen, Tagesdetail, Kalender, Heatmap, Year-Selector, Backend-Error-Codes).
```

Root `package.json`: `"version": "0.5.0"` → `"version": "0.6.0"`.
`ui/package.json`: `"version": "0.5.0"` → `"version": "0.6.0"`.

- [ ] **Step 10.3: Final Smoke**

```bash
pnpm test          # 136 backend tests grün
pnpm typecheck
pnpm typecheck:ui
pnpm lint:check
pnpm lint:ui
```

Alle exit 0.

- [ ] **Step 10.4: Release-Commit**

```bash
git add CHANGELOG.md package.json ui/package.json
git commit -m "chore: release 0.6.0 — phase 2.b complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 10.5: Working-Tree + git log review**

```bash
git status
git log --oneline | head -25
```

Clean. Phase 2.B Story in den Commits sichtbar.

---

## Phase-2.B-Abschluss-Kriterien

- [x] `pnpm dev` + `pnpm dev:ui` → Übersicht voll funktional (Task 10.1)
- [x] Optimistic Updates bei Day-CRUD (Task 7 + 3)
- [x] Sonner-Theme aus `rk-theme` abgeleitet (Task 2.3)
- [x] 136 Backend-Tests bleiben grün (Task 10.3)
- [x] typecheck + lint für Backend + UI grün (Task 10.3)
- [x] CHANGELOG `[0.6.0]` (Task 10.2)
