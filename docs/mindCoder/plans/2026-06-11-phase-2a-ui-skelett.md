# Phase 2.A — UI-Skelett Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development.

**Goal:** Vite-React-UI-Skelett im `ui/`-Workspace mit Dark Mode, DE/EN-i18n, typisiertem API-Client, Login-Flow und Layout mit 4 Placeholder-Pages. Per Browser nutzbar (Login → Layout → Logout).

**Architecture:** UI als zweiter pnpm-Workspace mit eigenem Build. React 19 + Tailwind 3.4 + shadcn/ui + react-router-dom v6 + react-i18next. Vite-Dev-Proxy auf Backend-Port 3030. Theme + Sprache in localStorage. API-Client wirft typisierte `ApiError`/`UnauthorizedError`.

**Tech Stack:** React 19, Vite 5, TypeScript strict, Tailwind 3.4, shadcn/ui, react-router-dom v6, react-i18next, lucide-react.

**Spec:** [2026-06-11-phase-2a-ui-skelett-design.md](../specs/2026-06-11-phase-2a-ui-skelett-design.md)

**CWD:** `c:\Projekte\Reisen\reisekontor`

---

## File-Struktur am Ende

```
reisekontor/
├── pnpm-workspace.yaml         # MODIFY — "- ui" ergänzt
├── package.json                # MODIFY — dev:ui, build:ui Scripts
├── biome.json                  # MODIFY — ignore ui/dist
└── ui/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── components.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── components/
        │   ├── ui/             # shadcn Komponenten (button, input, label, card, sonner)
        │   ├── ProtectedLayout.tsx
        │   ├── TopBar.tsx
        │   └── NavTabs.tsx
        ├── pages/
        │   ├── Login.tsx
        │   ├── Uebersicht.tsx
        │   ├── Reisen.tsx
        │   ├── Export.tsx
        │   └── Einstellungen.tsx
        ├── lib/
        │   ├── api.ts
        │   ├── i18n.ts
        │   ├── theme.ts
        │   └── utils.ts        # cn() utility für shadcn
        └── locales/
            ├── de.json
            └── en.json
```

---

## Task 1: UI-Workspace + Vite + Dependencies

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `ui/package.json`, `ui/tsconfig.json`, `ui/tsconfig.node.json`, `ui/vite.config.ts`, `ui/index.html`
- Modify: `package.json` (Root) — Scripts
- Modify: `biome.json` — ignore `ui/dist`, `ui/node_modules`

- [ ] **Step 1.1: `pnpm-workspace.yaml` erweitern**

```yaml
packages:
  - .
  - ui
```

- [ ] **Step 1.2: `ui/package.json`**

```json
{
  "name": "@reisekontor/ui",
  "version": "0.5.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "biome check --write src",
    "lint:check": "biome check src"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0",
    "react-i18next": "^15.4.0",
    "i18next": "^24.2.0",
    "i18next-browser-languagedetector": "^8.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "tailwindcss-animate": "^1.0.7",
    "lucide-react": "^0.470.0",
    "sonner": "^1.7.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49"
  }
}
```

- [ ] **Step 1.3: `ui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "resolveJsonModule": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.4: `ui/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 1.5: `ui/vite.config.ts`**

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 1.6: `ui/index.html`**

```html
<!doctype html>
<html lang="de" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reisekontor</title>
    <script>
      // Vor dem React-Mount: gespeichertes Theme anwenden, sonst Dark Default
      (function () {
        var t = localStorage.getItem("rk-theme");
        if (t === "light") document.documentElement.classList.remove("dark");
        else document.documentElement.classList.add("dark");
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 1.7: Root `package.json` Scripts erweitern**

Aktuelle Scripts behalten, hinzufügen:
```json
"dev:ui": "pnpm --filter @reisekontor/ui dev",
"build:ui": "pnpm --filter @reisekontor/ui build",
"typecheck:ui": "pnpm --filter @reisekontor/ui typecheck",
"lint:ui": "pnpm --filter @reisekontor/ui lint:check"
```

- [ ] **Step 1.8: Root `biome.json` ignore-Liste erweitern**

Aktuelle `files.ignore`:
```json
"ignore": ["node_modules", "dist", "coverage", "src/db/migrations"]
```

Ergänzen um `"ui/dist", "ui/node_modules"`:
```json
"ignore": ["node_modules", "dist", "coverage", "src/db/migrations", "ui/dist", "ui/node_modules"]
```

- [ ] **Step 1.9: Dependencies installieren**

```bash
pnpm install
```

Erwartung: pnpm legt `ui/node_modules` an und linkt Workspaces. Lock-File aktualisiert.

- [ ] **Step 1.10: typecheck (UI muss noch nichts erfolgreich machen — nur Setup-Check)**

```bash
pnpm typecheck       # Backend, weiterhin grün
pnpm test            # 136 Backend-Tests, weiterhin grün
```

`pnpm typecheck:ui` wird in Task 2 grün, sobald die `src/main.tsx` existiert.

- [ ] **Step 1.11: Commit**

```bash
git add pnpm-workspace.yaml package.json biome.json pnpm-lock.yaml ui/
git commit -m "feat(ui): pnpm-workspace + vite + react + ts + proxy setup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Tailwind + shadcn/ui Init + Basis-Komponenten

**Files:**
- Create: `ui/tailwind.config.ts`, `ui/postcss.config.js`, `ui/components.json`
- Create: `ui/src/index.css`
- Create: `ui/src/lib/utils.ts`
- Create: `ui/src/components/ui/button.tsx`
- Create: `ui/src/components/ui/input.tsx`
- Create: `ui/src/components/ui/label.tsx`
- Create: `ui/src/components/ui/card.tsx`
- Create: `ui/src/components/ui/sonner.tsx`

- [ ] **Step 2.1: `ui/tailwind.config.ts`** (shadcn-Default für Dark Mode)

```ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
```

- [ ] **Step 2.2: `ui/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 2.3: `ui/components.json` (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2.4: `ui/src/index.css`** (shadcn default + Dark Mode Variablen)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 2.5: `ui/src/lib/utils.ts`** (shadcn-Standard)

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2.6: shadcn-Komponenten kopieren**

Statt `pnpm dlx shadcn@latest add ...` interaktiv zu callen, kopiere die folgenden Komponenten direkt (alle aus dem shadcn-Default-Style, deterministisch). Jede Datei vollständig:

**`ui/src/components/ui/button.tsx`:**
```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**`ui/src/components/ui/input.tsx`:**
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

**`ui/src/components/ui/label.tsx`:**
```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

**`ui/src/components/ui/card.tsx`:**
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

**`ui/src/components/ui/sonner.tsx`:**
```tsx
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
```

- [ ] **Step 2.7: minimal `main.tsx` + `App.tsx` damit typecheck grün ist**

`ui/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`ui/src/App.tsx` (vorerst Stub, wird in Task 7 ersetzt):
```tsx
export default function App() {
  return <div className="p-8">Reisekontor UI — Setup läuft</div>;
}
```

- [ ] **Step 2.8: typecheck + dev-Server starten**

```bash
pnpm --filter @reisekontor/ui typecheck
```

Expected: clean.

```bash
pnpm dev:ui
```

In Browser `http://localhost:5174` → sieht „Reisekontor UI — Setup läuft" auf dunklem Hintergrund. Ctrl+C zum stoppen.

- [ ] **Step 2.9: Commit**

```bash
git add ui/
git commit -m "feat(ui): tailwind + shadcn basis-komponenten (button, input, label, card, sonner)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: i18n + Theme

**Files:**
- Create: `ui/src/lib/i18n.ts`
- Create: `ui/src/lib/theme.ts`
- Create: `ui/src/locales/de.json`
- Create: `ui/src/locales/en.json`

- [ ] **Step 3.1: `ui/src/locales/de.json`**

```json
{
  "common.login": "Anmelden",
  "common.logout": "Abmelden",
  "common.password": "Passwort",
  "common.theme.toggle": "Theme umschalten",
  "common.language": "Sprache",
  "common.language.de": "Deutsch",
  "common.language.en": "Englisch",

  "nav.uebersicht": "Übersicht",
  "nav.reisen": "Reisen",
  "nav.export": "Export",
  "nav.einstellungen": "Einstellungen",

  "pages.login.title": "Anmelden",
  "pages.login.submit": "Anmelden",
  "pages.login.password_placeholder": "Passwort",
  "pages.uebersicht.title": "Übersicht",
  "pages.uebersicht.placeholder": "Kalender, Kennzahlen und Heatmap kommen in Phase 2.B.",
  "pages.reisen.title": "Reisen",
  "pages.reisen.placeholder": "Reisen-Liste und -Detail kommen in Phase 2.C.",
  "pages.export.title": "Export",
  "pages.export.placeholder": "Export-Dialog kommt in Phase 3.",
  "pages.einstellungen.title": "Einstellungen",
  "pages.einstellungen.placeholder": "Standardwoche, Bundesland und Pauschalen-Ansicht kommen in Phase 2.C.",

  "errors.invalid_password": "Falsches Passwort.",
  "errors.invalid_body": "Ungültige Eingabe.",
  "errors.network": "Netzwerkfehler. Bitte erneut versuchen.",
  "errors.unauthorized": "Bitte erneut anmelden.",
  "errors.unknown": "Unbekannter Fehler."
}
```

- [ ] **Step 3.2: `ui/src/locales/en.json`** (gleiche Keys, englische Werte)

```json
{
  "common.login": "Sign in",
  "common.logout": "Sign out",
  "common.password": "Password",
  "common.theme.toggle": "Toggle theme",
  "common.language": "Language",
  "common.language.de": "German",
  "common.language.en": "English",

  "nav.uebersicht": "Overview",
  "nav.reisen": "Trips",
  "nav.export": "Export",
  "nav.einstellungen": "Settings",

  "pages.login.title": "Sign in",
  "pages.login.submit": "Sign in",
  "pages.login.password_placeholder": "Password",
  "pages.uebersicht.title": "Overview",
  "pages.uebersicht.placeholder": "Calendar, metrics and heatmap will arrive in Phase 2.B.",
  "pages.reisen.title": "Trips",
  "pages.reisen.placeholder": "Trip list and detail will arrive in Phase 2.C.",
  "pages.export.title": "Export",
  "pages.export.placeholder": "Export dialog will arrive in Phase 3.",
  "pages.einstellungen.title": "Settings",
  "pages.einstellungen.placeholder": "Default week, federal state and rate display will arrive in Phase 2.C.",

  "errors.invalid_password": "Wrong password.",
  "errors.invalid_body": "Invalid input.",
  "errors.network": "Network error. Please try again.",
  "errors.unauthorized": "Please sign in again.",
  "errors.unknown": "Unknown error."
}
```

- [ ] **Step 3.3: `ui/src/lib/i18n.ts`**

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
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
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

- [ ] **Step 3.4: `ui/src/lib/theme.ts`**

```ts
export type Theme = "dark" | "light";

const STORAGE_KEY = "rk-theme";

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function toggleTheme(): Theme {
  const next = getStoredTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
```

- [ ] **Step 3.5: i18n importieren in `main.tsx`**

`ui/src/main.tsx` ergänzen (Import + `Suspense` für i18n-Loading):
```tsx
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n.ts";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Suspense fallback={<div className="p-8">…</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
```

- [ ] **Step 3.6: typecheck**

```bash
pnpm typecheck:ui
```

- [ ] **Step 3.7: Commit**

```bash
git add ui/src/lib/i18n.ts ui/src/lib/theme.ts ui/src/locales/ ui/src/main.tsx
git commit -m "feat(ui): i18n (DE/EN) + theme-toggle mit localStorage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: API-Client

**Files:**
- Create: `ui/src/lib/api.ts`

- [ ] **Step 4.1: API-Client schreiben**

`ui/src/lib/api.ts`:
```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(code = "unauthorized", message?: string) {
    super(401, code, message);
    this.name = "UnauthorizedError";
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(0, "network", message);
    this.name = "NetworkError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new UnauthorizedError(body.error ?? "unauthorized");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
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
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  getHealth: () => request<HealthResponse>("/api/health"),
};
```

- [ ] **Step 4.2: typecheck**

```bash
pnpm typecheck:ui
```

- [ ] **Step 4.3: Commit**

```bash
git add ui/src/lib/api.ts
git commit -m "feat(ui): typisierter api-client mit ApiError/UnauthorizedError

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Login-Page

**Files:**
- Create: `ui/src/pages/Login.tsx`

- [ ] **Step 5.1: Login-Page schreiben**

`ui/src/pages/Login.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, UnauthorizedError } from "@/lib/api";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Wenn schon eingeloggt → direkt weiter
  useEffect(() => {
    api
      .getHealth()
      .then(() => navigate("/uebersicht", { replace: true }))
      .catch(() => {});
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.login(password);
      navigate("/uebersicht", { replace: true });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        toast.error(t("errors.invalid_password"));
      } else {
        toast.error(t("errors.network"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("pages.login.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("pages.login.password_placeholder")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {t("pages.login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5.2: typecheck**

- [ ] **Step 5.3: Commit**

```bash
git add ui/src/pages/Login.tsx
git commit -m "feat(ui): login-page mit api-client und toast-feedback

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: ProtectedLayout + TopBar + NavTabs

**Files:**
- Create: `ui/src/components/ProtectedLayout.tsx`
- Create: `ui/src/components/TopBar.tsx`
- Create: `ui/src/components/NavTabs.tsx`

- [ ] **Step 6.1: `TopBar.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { toggleTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { useState } from "react";

export function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<Theme>(getStoredTheme());

  function handleThemeToggle() {
    setThemeState(toggleTheme());
  }

  function handleLanguageChange(lang: "de" | "en") {
    void i18n.changeLanguage(lang);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Logout idempotent — ignore Fehler
    }
    navigate("/login", { replace: true });
  }

  return (
    <header className="border-b bg-background">
      <div className="container flex h-14 items-center justify-between">
        <div className="font-semibold">Reisekontor</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <Button
              variant={i18n.resolvedLanguage === "de" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleLanguageChange("de")}
            >
              DE
            </Button>
            <Button
              variant={i18n.resolvedLanguage === "en" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleLanguageChange("en")}
            >
              EN
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            aria-label={t("common.theme.toggle")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label={t("common.logout")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6.2: `NavTabs.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/uebersicht", labelKey: "nav.uebersicht" },
  { to: "/reisen", labelKey: "nav.reisen" },
  { to: "/export", labelKey: "nav.export" },
  { to: "/einstellungen", labelKey: "nav.einstellungen" },
] as const;

export function NavTabs() {
  const { t } = useTranslation();
  return (
    <nav className="border-b bg-background">
      <div className="container flex h-12 items-center gap-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6.3: `ProtectedLayout.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { TopBar } from "./TopBar";
import { NavTabs } from "./NavTabs";
import { api, UnauthorizedError } from "@/lib/api";

export function ProtectedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .getHealth()
      .then(() => setReady(true))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          navigate("/login", { replace: true });
        } else {
          // Network-Fehler oder unbekannt: trotzdem rendern, Pages werden ihre eigenen Errors zeigen
          setReady(true);
        }
      });
  }, [navigate]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center">…</div>;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <NavTabs />
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 6.4: typecheck + Commit**

```bash
git add ui/src/components/
git commit -m "feat(ui): protected layout + topbar + nav tabs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 4 Placeholder-Pages + Router-Setup in App.tsx

**Files:**
- Create: `ui/src/pages/Uebersicht.tsx`, `Reisen.tsx`, `Export.tsx`, `Einstellungen.tsx`
- Modify: `ui/src/App.tsx`

- [ ] **Step 7.1: Placeholder-Page-Template**

Identisches Muster für alle 4 Seiten. Beispiel `ui/src/pages/Uebersicht.tsx`:
```tsx
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Uebersicht() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.uebersicht.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("pages.uebersicht.placeholder")}</p>
      </CardContent>
    </Card>
  );
}
```

Analog `Reisen.tsx`, `Export.tsx`, `Einstellungen.tsx` mit den jeweiligen i18n-Keys (`pages.reisen.*`, `pages.export.*`, `pages.einstellungen.*`).

- [ ] **Step 7.2: `ui/src/App.tsx` mit Router**

```tsx
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import Login from "@/pages/Login";
import Uebersicht from "@/pages/Uebersicht";
import Reisen from "@/pages/Reisen";
import Export from "@/pages/Export";
import Einstellungen from "@/pages/Einstellungen";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="/uebersicht" replace /> },
      { path: "uebersicht", element: <Uebersicht /> },
      { path: "reisen", element: <Reisen /> },
      { path: "export", element: <Export /> },
      { path: "einstellungen", element: <Einstellungen /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
```

- [ ] **Step 7.3: typecheck + build verifizieren**

```bash
pnpm typecheck:ui
pnpm build:ui
```

Build muss erfolgreich `ui/dist/` produzieren.

- [ ] **Step 7.4: Commit**

```bash
git add ui/src/App.tsx ui/src/pages/
git commit -m "feat(ui): 4 placeholder-pages + router-setup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Manueller Browser-Smoke + Release 0.5.0

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (Root)
- Modify: `ui/package.json` (Version-Sync)

- [ ] **Step 8.1: Beide Server starten + Browser-Smoke**

In Terminal 1:
```bash
pnpm dev
```
Server auf 3030 läuft. Falls Port-Konflikt von früheren Background-Servern: `lsof`/`netstat` checken.

In Terminal 2:
```bash
pnpm dev:ui
```
Vite auf 5174.

Browser `http://localhost:5174`:
1. Redirected zu `/login`
2. Passwort `test123` → 200 → redirected zu `/uebersicht`
3. Theme-Toggle anklicken → Hell/Dunkel wechseln (persistiert)
4. DE/EN-Switcher → Texte wechseln (persistiert)
5. 4 Tabs durchklicken → Placeholder-Inhalte je Tab
6. Logout-Icon → redirected zu `/login`
7. Falsches Passwort → Toast „Falsches Passwort"

Wenn etwas nicht funktioniert: Browser-DevTools-Console + Server-Logs prüfen, fixen, neu versuchen.

Beide Server stoppen.

- [ ] **Step 8.2: Final Tests**

```bash
pnpm test            # 136 Backend-Tests, weiterhin grün
pnpm typecheck       # Backend grün
pnpm typecheck:ui    # UI grün
pnpm lint:check      # Backend grün
pnpm lint:ui         # UI grün (Biome lokal in ui/)
```

- [ ] **Step 8.3: CHANGELOG erweitern**

In `CHANGELOG.md` über `## [0.4.0]` einfügen:
```markdown
## [Unreleased]

## [0.5.0] — 2026-06-11

### Added
- `ui/` — neuer pnpm-Workspace mit Vite + React 19 + TypeScript strict.
- `ui/src/lib/api.ts` — typisierter API-Client mit `ApiError`/`UnauthorizedError`/`NetworkError`.
- `ui/src/lib/i18n.ts` — react-i18next mit DE als Default und EN als Switch (`ui/src/locales/{de,en}.json`).
- `ui/src/lib/theme.ts` — Dark/Light-Toggle, persistiert in `localStorage['rk-theme']`.
- Tailwind CSS 3.4 mit Dark-Mode (class-based, Default dark) und shadcn/ui-Basis-Komponenten (button, input, label, card, sonner).
- React-Router v6 mit `/login` (öffentlich) + `/uebersicht`/`/reisen`/`/export`/`/einstellungen` (auth-protected via `ProtectedLayout`).
- `LoginPage` mit POST `/api/auth/login`-Integration + Toast-Feedback bei falschem Passwort.
- `TopBar` mit Sprach-Switcher, Theme-Toggle und Logout.
- `NavTabs` mit aktivem-Tab-Highlight.
- Vite-Dev-Proxy: `/api` → `http://localhost:3030`.

### Changed
- `package.json` — Version 0.5.0, neue Scripts `dev:ui`, `build:ui`, `typecheck:ui`, `lint:ui`.
- `pnpm-workspace.yaml` — `ui` als zweiter Workspace.
- `biome.json` — `ui/dist` und `ui/node_modules` ignoriert.
```

- [ ] **Step 8.4: Versionen syncen**

Root `package.json`: `"version": "0.4.0"` → `"version": "0.5.0"`.
`ui/package.json`: `"version": "0.5.0"` (sollte schon stehen).

- [ ] **Step 8.5: Release-Commit**

```bash
git add CHANGELOG.md package.json ui/package.json
git commit -m "chore: release 0.5.0 — phase 2.a complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 8.6: Final Working-Tree-Check**

```bash
git status
git log --oneline | head -25
```

Working tree clean. Log zeigt Phase 2.A Story.

---

## Phase-2.A-Abschluss-Kriterien

- [x] `pnpm install` läuft sauber (Task 1)
- [x] `pnpm dev:ui` startet auf Port 5174 (Tasks 2 + 8)
- [x] Browser-Smoke: Login → 4 Tabs → Theme + Sprache → Logout (Task 8.1)
- [x] `pnpm build:ui` produziert `ui/dist` (Task 7)
- [x] `pnpm test` → 136 Backend-Tests grün (Task 8.2)
- [x] `pnpm typecheck` + `pnpm typecheck:ui` grün (Task 8.2)
- [x] `pnpm lint:check` + `pnpm lint:ui` grün (Task 8.2)
- [x] CHANGELOG `[0.5.0]` (Task 8.3)
