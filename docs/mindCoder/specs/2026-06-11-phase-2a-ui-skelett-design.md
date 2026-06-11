# Phase 2.A — UI-Skelett + Login + Layout

**Datum:** 2026-06-11
**Projekt:** Reisekontor
**Grundlage:** [Implementierungsdokument v1.0](../../../../Reisekontor_Implementierungsdokument.docx), [Phase 1.C](2026-06-11-phase-1c-feiertage-checks-design.md)
**Status:** Implementierungsbereit

## 1. Zweck dieser Phase

Phase 2.A liefert das UI-Skelett: einen eigenen pnpm-Workspace `ui/` mit Vite + React + Tailwind + shadcn/ui, durchgängig im Dark Mode, mit DE/EN-i18n-Skelett, einem typisierten API-Client und einem Login-Flow. Am Ende kann sich der User per Passwort einloggen und sieht ein Layout mit Navigation zu 4 Tabs (Übersicht, Reisen, Export, Einstellungen) — jeder Tab zeigt einen Platzhalter mit Hinweis auf die Phase, in der er gebaut wird.

Konkrete Seiten-Inhalte (Kalender, Reisen-Liste, Export-Dialog, Einstellungs-Form) kommen in 2.B/2.C/2.D.

## 2. Scope

### Im Scope von Phase 2.A

- pnpm-Workspace erweitert (`ui` als zweiter Workspace neben dem Root)
- `ui/` mit eigenem `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`
- React 19 + TypeScript strict + Vite
- Tailwind CSS 3.4 mit Dark-Mode (class-based, default = dark)
- shadcn/ui — initialisiert + Basis-Komponenten kopiert (button, input, card, sonner/toast)
- react-router-dom v6 mit folgenden Routen:
  - `/login` (öffentlich)
  - `/` (geschützt, redirect auf `/uebersicht`)
  - `/uebersicht`, `/reisen`, `/export`, `/einstellungen` (alle geschützt, Platzhalter-Inhalt)
- Auth-Guard: bei 401 vom Backend → Redirect auf `/login`
- react-i18next mit DE als Default, EN umschaltbar; Translation-Files unter `ui/src/locales/`
- Sprach-Umschalter und Theme-Toggle (Dark/Light, persistiert in localStorage)
- Typisierter API-Client (`ui/src/lib/api.ts`) mit fetch()-Wrappern für `/api/auth/login`, `/api/auth/logout`, `/api/health`
- Vite-Dev-Proxy: `/api` → `http://localhost:3030` (Backend)
- `package.json` Root-Script `pnpm --filter ui dev` und `pnpm --filter ui build`
- Smoke: `pnpm dev` (Backend) + `pnpm --filter ui dev` (UI) → Browser auf `http://localhost:5174` → Login mit `test123` → Layout sichtbar → 4 Tabs klickbar
- CHANGELOG `[0.5.0] — 2026-06-11`

### Out of Scope für Phase 2.A

- Kalender, Tagesdetail-Panel, Übersicht-Inhalt (Phase 2.B)
- Reisen-Liste, Reisen-Erstellen-Form, Reisen-Detail (Phase 2.C)
- Export-Dialog, PDF/Excel-Download (Phase 3 + 2.D)
- Einstellungen-Form, `/api/settings`-Backend (Phase 2.C/D)
- Component-Tests, E2E-Tests (kommen sukzessive mit Inhalt in 2.B+)
- TanStack Query (kommt in 2.B mit echten Daten)
- Recharts (kommt in 2.B für die Heatmap)
- shadcn/ui-Komponenten jenseits der Basis (calendar, dialog, sheet, tabs etc. kommen on-demand in 2.B+)

## 3. Architekturentscheidungen

### 3.1 UI als eigener pnpm-Workspace, eigener Build

Das Implementierungsdokument §3 + §10 verlangt das explizit: „Die UI hat ein eigenes `package.json` und einen eigenen Build-Prozess." Die UI-TypeScript-Welt ist separat von der Server-Welt. Vorteil: UI-Deps (React, Tailwind, shadcn) verschmutzen nicht das Server-`node_modules`. Vite produziert beim Build statische Dateien in `ui/dist/`, die in Phase 4 von Hono serviert werden.

`pnpm-workspace.yaml` wird erweitert um `- ui`.

### 3.2 React 19 + TypeScript strict + Vite

- React 19 ist seit Q4 2024 stable; shadcn/ui-Komponenten sind voll kompatibel.
- TypeScript strict mit `"strict": true`, `"noUncheckedIndexedAccess": true`, `"jsx": "react-jsx"`.
- Vite 5 mit `@vitejs/plugin-react`.

### 3.3 Tailwind CSS 3.4, nicht v4

Tailwind v4 (Q1 2025) hat eine andere Config-Syntax (CSS-first). shadcn/ui ist 2026 noch primär für v3 dokumentiert und getestet. Pragmatisch: v3.4.x, default `darkMode: 'class'`.

### 3.4 Dark Mode default-on

CLAUDE.md / Anforderungsdokument §3 sagt „Darstellung durchgängig im Dark Mode". `<html class="dark">` ist initial gesetzt (in `index.html`). Theme-Toggle persistiert in `localStorage['rk-theme']` mit Werten `dark` / `light`. Beim Mount liest ein kleines Inline-Script die Präferenz vor dem React-Mount → kein Flash.

### 3.5 shadcn/ui mit kopierten Komponenten, nicht installiert

Per `npx shadcn@latest init` (neueres Package-Name, der `-ui`-Suffix ist deprecated). Komponenten liegen unter `ui/src/components/ui/`. In 2.A werden initialisiert: `button`, `input`, `label`, `card`, `sonner` (Toast). Weitere kommen on-demand.

`components.json` wird mit Tailwind-Style "default" und Dark-Mode-Preset konfiguriert.

### 3.6 react-i18next mit DE Default, EN Switch

Translation-Files unter `ui/src/locales/{de,en}.json` als flache Key-Value-Maps. Beispiel: `{"common.login": "Anmelden", "common.logout": "Abmelden", "pages.uebersicht.title": "Übersicht"}`.

- Default-Sprache: DE
- Detection: erst `localStorage['rk-lang']`, dann Browser-Language, sonst DE
- Umschalter in der Top-Bar (Dropdown oder zwei Buttons)
- Backend-Antworten (Error-Codes wie `invalid_password`, `reise_type_via_trips`) werden im UI über i18n-Keys übersetzt: `errors.invalid_password` → „Falsches Passwort"

### 3.7 React Router v6 mit Auth-Guard

`createBrowserRouter()` mit:
- `/login` als öffentliche Route
- Alle anderen Routen unter einem `<ProtectedLayout />` der bei 401-Responses des API-Clients auf `/login` redirected

Der API-Client wirft eine `UnauthorizedError` bei 401; ein React-Context (`AuthProvider`) oder einfacher Event-Bus fängt die und triggert den Redirect.

### 3.8 Typisierter API-Client (`ui/src/lib/api.ts`)

Kein OpenAPI-Generator. Manuell geschriebene Wrapper, die zu den 9 Backend-Routen passen. Pattern:
```ts
export async function login(password: string): Promise<{ ok: true }>;
export async function logout(): Promise<{ ok: true }>;
export async function getHealth(): Promise<HealthResponse>;
// Folgende werden in 2.B+ ergänzt:
// listDays(year), upsertDay(date, body), deleteDay(date),
// listTrips(year), createTrip(body), updateTrip(id, body), deleteTrip(id),
// getSummary(year), syncHolidays(year), getChecks(year)
```

In 2.A: nur `login`, `logout`, `getHealth`. Die anderen kommen mit den Seiten.

Alle Calls verwenden `credentials: "same-origin"` (Cookie wird vom Browser mitgesendet), JSON-Bodies, Werfen `ApiError` mit `status` + `code` bei Non-2xx-Antworten. `UnauthorizedError extends ApiError` für 401.

### 3.9 Vite-Dev-Proxy

`vite.config.ts`:
```ts
server: {
  port: 5174,
  proxy: {
    "/api": "http://localhost:3030",
  },
}
```

Port 5174 weil finanz-app schon 5173 nutzt (Memory `project_finanz_app_ports`). Im Proxy-Modus: Browser sieht `http://localhost:5174/api/...` → Vite leitet an `http://localhost:3030/api/...` weiter. Cookies same-origin sicher.

Im Production-Build (Phase 4): Hono serviert sowohl `ui/dist/` als auch `/api/*` aus demselben Prozess → kein Proxy mehr nötig.

### 3.10 Keine UI-Tests in 2.A

Component-Tests / E2E-Tests kommen mit echtem Inhalt in 2.B+. In 2.A ist „Smoke" = Browser-Login-Flow manuell durchklicken. Backend-Tests (136) bleiben grün und müssen es auch.

Begründung: Component-Tests für statische Platzhalter-Seiten haben minimalen Wert. React Testing Library + Vitest werden in 2.B installiert, wenn die ersten interaktiven Komponenten getestet werden.

### 3.11 Versionsbump 0.5.0

Neue UI-Komponente in einem neuen Workspace, neue User-facing Funktionen (Login-UI) → Minor-Bump.

## 4. UI-Workspace-Setup

### 4.1 Verzeichnis-Struktur

```
reisekontor/
├── pnpm-workspace.yaml         # MODIFY — "- ui" ergänzen
├── package.json                # MODIFY — neue Helper-Scripts
└── ui/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json      # für vite.config.ts
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── components.json         # shadcn/ui config
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css           # Tailwind-Directives
        ├── components/
        │   ├── ui/             # shadcn/ui-Komponenten (button, input, card, sonner)
        │   ├── ProtectedLayout.tsx
        │   ├── TopBar.tsx
        │   └── NavTabs.tsx
        ├── pages/
        │   ├── Login.tsx
        │   ├── Uebersicht.tsx  # Platzhalter
        │   ├── Reisen.tsx      # Platzhalter
        │   ├── Export.tsx      # Platzhalter
        │   └── Einstellungen.tsx
        ├── lib/
        │   ├── api.ts          # fetch-Wrappers + ApiError-Klassen
        │   ├── i18n.ts         # react-i18next Setup
        │   └── theme.ts        # Dark/Light-Toggle, localStorage
        └── locales/
            ├── de.json
            └── en.json
```

### 4.2 Root `package.json` Scripts

```json
{
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server/index.ts",
    "dev:ui": "pnpm --filter ui dev",
    "build:ui": "pnpm --filter ui build",
    "test": "vitest run",
    "...": "..."
  }
}
```

`pnpm dev:ui` und `pnpm build:ui` als Convenience.

### 4.3 `ui/package.json` (Auszug)

Deps:
- `react`, `react-dom`
- `react-router-dom`
- `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- `class-variance-authority`, `clsx`, `tailwind-merge` (shadcn-Dependencies)
- `lucide-react` (Icons für shadcn)

Dev-Deps:
- `@types/react`, `@types/react-dom`
- `@vitejs/plugin-react`, `vite`, `typescript`
- `tailwindcss`, `autoprefixer`, `postcss`, `tailwindcss-animate`

### 4.4 `ui/tsconfig.json`

Strict, JSX `react-jsx`, target ES2022, moduleResolution Bundler, `paths` mit `@/*` → `./src/*` (shadcn-Konvention).

## 5. Komponenten + Routing

### 5.1 Routing-Tree

```tsx
<RouterProvider router={createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="/uebersicht" replace /> },
      { path: "uebersicht", element: <UebersichtPage /> },
      { path: "reisen", element: <ReisenPage /> },
      { path: "export", element: <ExportPage /> },
      { path: "einstellungen", element: <EinstellungenPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])} />
```

### 5.2 `ProtectedLayout` (`src/components/ProtectedLayout.tsx`)

- Beim Mount: ein leichter `getHealth()`-Call → wenn 401 → Redirect `/login`
- Layout: `<TopBar />` + `<NavTabs />` + `<Outlet />` (für die Sub-Routen)

### 5.3 `TopBar`

App-Name links, rechts: Sprach-Switcher (DE / EN), Theme-Toggle (Sonne/Mond-Icon), Logout-Button. shadcn `Button`-Komponente, `lucide-react` Icons.

### 5.4 `NavTabs`

Vier Tabs als horizontale Navigation mit aktivem-Tab-Highlight via `useLocation()`. Pro Tab: i18n-Key + Icon.

### 5.5 `LoginPage`

Zentriertes `Card` mit:
- Heading: i18n `pages.login.title` („Anmelden")
- `Input` für Passwort (`type="password"`, autofocus)
- `Button` „Anmelden"
- Auf Submit: `api.login(password)` → bei Erfolg navigate `/uebersicht`, bei 401 Toast „Falsches Passwort"

Wenn der User schon eingeloggt ist (zu `/login` navigiert mit gültigem Cookie), wird ein `getHealth()`-Call gemacht; bei 200 → redirect `/uebersicht`.

### 5.6 Placeholder-Pages

Jede der vier Seiten zeigt:
```tsx
<Card>
  <CardHeader>
    <CardTitle>{t(`pages.${slug}.title`)}</CardTitle>
  </CardHeader>
  <CardContent>
    <p>{t(`pages.${slug}.placeholder`)}</p>
    <p className="text-sm text-muted-foreground">{t(`pages.${slug}.coming_in`)}</p>
  </CardContent>
</Card>
```

i18n-Werte:
- Übersicht → „Kalender, Kennzahlen und Heatmap kommen in Phase 2.B."
- Reisen → „Reisen-Liste und -Detail kommen in Phase 2.C."
- Export → „Export-Dialog kommt in Phase 3."
- Einstellungen → „Standardwoche, Bundesland und Pauschalen-Ansicht kommen in Phase 2.C."

## 6. i18n

### 6.1 Setup (`ui/src/lib/i18n.ts`)

```ts
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import de from "../locales/de.json";
import en from "../locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de }, en: { translation: en } },
    fallbackLng: "de",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "rk-lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
```

### 6.2 Translation-Keys (Initial-Set für 2.A)

```json
// de.json
{
  "common.login": "Anmelden",
  "common.logout": "Abmelden",
  "common.password": "Passwort",
  "common.theme.light": "Hell",
  "common.theme.dark": "Dunkel",
  "common.language.de": "Deutsch",
  "common.language.en": "Englisch",

  "nav.uebersicht": "Übersicht",
  "nav.reisen": "Reisen",
  "nav.export": "Export",
  "nav.einstellungen": "Einstellungen",

  "pages.login.title": "Anmelden",
  "pages.login.submit": "Anmelden",
  "pages.uebersicht.title": "Übersicht",
  "pages.uebersicht.placeholder": "Kalender, Kennzahlen und Heatmap kommen in Phase 2.B.",
  "pages.reisen.title": "Reisen",
  "pages.reisen.placeholder": "Reisen-Liste und -Detail kommen in Phase 2.C.",
  "pages.export.title": "Export",
  "pages.export.placeholder": "Export-Dialog kommt in Phase 3.",
  "pages.einstellungen.title": "Einstellungen",
  "pages.einstellungen.placeholder": "Standardwoche, Bundesland und Pauschalen-Ansicht kommen in Phase 2.C.",

  "errors.invalid_password": "Falsches Passwort.",
  "errors.network": "Netzwerkfehler. Bitte erneut versuchen.",
  "errors.unauthorized": "Bitte erneut anmelden.",
  "errors.unknown": "Unbekannter Fehler."
}
```

`en.json` mit denselben Keys, englischen Werten.

### 6.3 Verwendung

`const { t } = useTranslation();` → `t("nav.uebersicht")`. Keine hartkodierten deutschen Strings in Komponenten.

## 7. API-Client + Auth-Flow

### 7.1 `ui/src/lib/api.ts`

```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}
export class UnauthorizedError extends ApiError {}
export class NetworkError extends ApiError {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    throw new NetworkError(0, "network", e instanceof Error ? e.message : String(e));
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new UnauthorizedError(401, body.error ?? "unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "unknown");
  }
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  uptime_seconds: number;
}

export const api = {
  login: (password: string) =>
    request<{ ok: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  getHealth: () => request<HealthResponse>("/api/health"),
};
```

### 7.2 Auth-Guard via `ProtectedLayout`

Beim Mount: `api.getHealth()`. Bei `UnauthorizedError` → `navigate("/login", {replace: true})`. Bei Network-Fehler → Toast mit Retry-Button. Bei 200 → render children.

Ein einfaches `useEffect` reicht; kein Context nötig in 2.A. In 2.B kann das auf TanStack Query refactoriert werden.

## 8. Smoke + Manuelles Testen

### 8.1 Lokal

Terminal 1:
```bash
pnpm dev
```
Backend läuft auf 3030.

Terminal 2:
```bash
pnpm dev:ui
```
Vite-Dev-Server läuft auf 5174.

Browser:
1. `http://localhost:5174` → redirected zu `/login`
2. Passwort `test123` eingeben → 200 → redirected zu `/uebersicht`
3. Theme-Toggle anklicken → Dark/Light wechselt, persistiert
4. Sprache-Switcher → DE/EN, persistiert
5. Tabs durchklicken → 4 Placeholder-Inhalte
6. Logout → redirected zu `/login`
7. Falsches Passwort → Toast „Falsches Passwort"

### 8.2 Build

```bash
pnpm build:ui
```
Output unter `ui/dist/`. Lädt im Browser via `python -m http.server` o. ä. (nur statisch, ohne Proxy → API-Calls schlagen fehl; das ist okay, wir testen nur den Build).

## 9. Abschluss-Kriterien

- [ ] `pnpm install` läuft sauber durch (mit dem neuen `ui`-Workspace)
- [ ] `pnpm dev:ui` startet Vite auf Port 5174
- [ ] Browser-Smoke: Login → 4 Tabs sichtbar → Theme + Sprache wechseln → Logout
- [ ] `pnpm build:ui` produziert `ui/dist/` ohne Fehler
- [ ] `pnpm test` → 136 Backend-Tests bleiben grün (UI hat noch keine eigenen Tests)
- [ ] `pnpm typecheck` für Backend grün; UI hat eigenen `tsc --noEmit`-Lauf via `pnpm --filter ui typecheck`
- [ ] `pnpm lint:check` für Backend grün; UI hat eigenen Biome-Lauf via `pnpm --filter ui lint`
- [ ] CHANGELOG `[0.5.0] — 2026-06-11`

## 10. Nächste Phase

Phase 2.B: Übersicht-Seite mit Monatskalender, Tagesdetail-Panel (Setzen von Typ + Mahlzeiten + Homeoffice-Flag), Kennzahlen-Karten (aus `/api/summary`), Heatmap (Recharts), Plausibilitätshinweise (aus `/api/checks`). TanStack Query für API-State.
