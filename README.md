# Reisekontor

Persönliche Web-App zur Erfassung von Verpflegungsmehraufwand und Homeoffice-Tagen für die Steuererklärung. Single-User, self-hosted.

**Status:** Phase 0 — Berechnungs-Engine. Kein lauffähiger Server, keine UI.

## Quick Start

Voraussetzungen: Node 22+, pnpm 9+.

```bash
pnpm install
pnpm test          # alle Tests
pnpm test:domain   # nur Berechnungs-Engine
pnpm lint          # Biome
pnpm typecheck     # tsc --noEmit
```

## Dokumentation

- `docs/architecture.md` — Architekturentscheidungen
- `docs/mindCoder/specs/` — Phasen-Specs
- `docs/mindCoder/plans/` — Implementierungspläne
- `specs/` — Mermaid-Diagramme (Domäne, Workflows)
- `CLAUDE.md` — Arbeitsanweisungen für Claude Code

## Stack (Endausbau)

TypeScript · Hono · SQLite + Drizzle · Vite + React + shadcn/ui · Vitest · Biome · Docker hinter Caddy.

In Phase 0 ist nur die Berechnungs-Engine (`src/domain/`) implementiert. Server, DB, UI und Deployment folgen in späteren Phasen.
