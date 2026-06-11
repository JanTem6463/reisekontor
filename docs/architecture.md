# Architektur-Entscheidungen

## Ein Container statt mehrerer Dienste

**Entscheidung:** Hono serviert API und statische UI in einem Prozess.
**Verworfen:** Separater nginx-Container für die UI.
**Warum:** Minimaler Betriebsaufwand, genau eine Komponente die laufen muss.

## Hono (TypeScript) statt FastAPI (Python)

**Entscheidung:** Backend in TypeScript via Hono.
**Warum:** Einsprachigkeit (Frontend + Backend in TS) vereinfacht Claude-Code-Generierung und Wartung. Hono ist im Agent-Template als HTTP-Layer vorgesehen.

## SQLite statt PostgreSQL

**Entscheidung:** Persistenz in einer SQLite-Datei.
**Warum:** Eine Person, geringe Datenmenge, keine Nebenläufigkeit. Dateibasiert, kein DB-Prozess, Backups sind Dateikopien.

## Beträge in Cent (Integer) statt Float

**Entscheidung:** Alle Geld-Werte sind Integer in Cent.
**Warum:** Float-Arithmetik produziert Rundungsfehler, die in einer Steueranwendung nicht akzeptabel sind. Steuerliche Korrektheit ist die wichtigste Qualitätszusage des Projekts.

## Sätze in Konfiguration statt im Code

**Entscheidung:** Steuersätze liegen je Jahr in `config/app.yaml`.
**Warum:** Sätze ändern sich jährlich. Konfigurations-Änderung ohne Code-Eingriff ist Pflicht.

## Domain ist 100 % rein

**Entscheidung:** `src/domain/` kennt keine I/O, keine DB, keinen Config-Loader. `Rates` werden als Parameter übergeben.
**Warum:** Vollständig testbar ohne Setup. Unabhängig davon, woher die Sätze kommen (YAML, DB-Override, Tenant-Konfig).

## Mitternachtsregelung — bewusste Vereinfachung

**Hintergrund:** Eine eintägige Reise ohne Übernachtung über zwei Kalendertage berechtigt zu **einer** kleinen Pauschale. Das Gesetz weist sie dem Tag mit der überwiegenden Abwesenheit zu — was Uhrzeiten voraussetzt.

**Entscheidung:** Reisekontor erfasst keine Uhrzeiten (Anforderungsdokument §1.3). Die Pauschale wird stets dem **Start-Datum** zugeordnet; der zweite Kalendertag bekommt keinen Reise-Eintrag und fällt auf den Standardwochen-Default zurück.

**Warum Start-Datum:** Bei Geschäftsreisen ist die überwiegende Aktivität typischerweise tagsüber am Anreisetag; die Nachtrückreise verschiebt nur den geografischen Aufenthalt, nicht den Geschäftszweck.

**Folge:** In seltenen Grenzfällen (z. B. Abendveranstaltung mit Übernachtungs-Verzicht und Heimkehr am frühen Folgetag) kann die Zuordnung von der Soll-Auslegung abweichen. Der Steuerberater korrigiert das im Einzelfall.
