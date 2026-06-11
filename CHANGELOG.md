# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung: [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added
- Projekt-Skelett: pnpm-Workspace, TypeScript strict, Vitest, Biome.
- `config/app.yaml` mit Sätzen 2026, Standardwoche, Bundesland NI.
- `src/shared/money.ts` — Cent-Formatierungs-Helpers.
- `src/domain/` — reine Berechnungs-Engine:
  - `types.ts` — `DayType`, `Meals`, `DayEntry`, `Rates`, `TripInput`, `ClassifiedDay`
  - `pauschalen.ts` — Kürzung, Verpflegung pro Tag, Homeoffice-Tage und -Pauschale
  - `trip-classify.ts` — Ableitung der Tagestypen aus Reisezeitraum
  - `plausibilitaet.ts` — Doppelerfassung, 8-h-Hinweis, Entfernungspauschalen-Konflikt
- Mermaid-Diagramme: `specs/domain/entities.mmd`, `specs/workflows/tagestyp.mmd`.
- Dokumentation: `CLAUDE.md`, `README.md`, `docs/architecture.md`.
- Alle Pflicht-Testfälle aus Implementierungsdokument §14.1 grün.
