import type { AppConfig } from "../config/index.ts";
import type { Db } from "../db/client.ts";
import { kuerzungCent, verpflegungProTagCent } from "../domain/pauschalen.ts";
import type { DayType } from "../domain/types.ts";
import * as daysService from "./days.ts";
import { computeEffectiveHomeofficeDates, homeofficeBetragCent } from "./effective-days.ts";
import { toDomainDay } from "./mappers.ts";
import { getEffectiveSettings } from "./settings.ts";

const REISE_TYPES: DayType[] = ["reise_anreise", "reise_voll", "reise_abreise", "reise_eintaegig"];

export interface ReisekostenRow {
  date: string;
  type: DayType;
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungCent: number;
  kuerzungCent: number;
  pauschaleCent: number;
  absetzbarCent: number;
}

export interface ReisekostenExport {
  year: number;
  rows: ReisekostenRow[];
  summe_pauschale_cent: number;
  summe_kuerzung_cent: number;
  summe_absetzbar_cent: number;
}

export interface HomeofficeRow {
  date: string;
}

export interface HomeofficeExport {
  year: number;
  rows: HomeofficeRow[];
  anzahl_tage: number;
  betrag_pro_tag_cent: number;
  betrag_gesamt_cent: number;
  max_tage: number;
  max_betrag_cent: number;
}

export function buildReisekostenRows(db: Db, year: number, config: AppConfig): ReisekostenExport {
  const rates = config.ratesForYear(year);
  const dbRows = daysService.listForYear(db, year);
  const reiseDays = dbRows
    .filter((d) => REISE_TYPES.includes(d.type as DayType))
    .sort((a, b) => a.date.localeCompare(b.date));

  const rows: ReisekostenRow[] = reiseDays.map((d) => {
    const domain = toDomainDay(d);
    const pauschale = domain.type === "reise_voll" ? rates.grosseCent : rates.kleineCent;
    const kuerz = kuerzungCent(domain.meals, rates);
    return {
      date: d.date,
      type: d.type as DayType,
      fruehstueck: d.fruehstueck,
      mittag: d.mittag,
      abend: d.abend,
      zuzahlungCent: d.zuzahlungCent,
      pauschaleCent: pauschale,
      kuerzungCent: kuerz,
      absetzbarCent: verpflegungProTagCent(domain, rates),
    };
  });

  return {
    year,
    rows,
    summe_pauschale_cent: rows.reduce((s, r) => s + r.pauschaleCent, 0),
    summe_kuerzung_cent: rows.reduce((s, r) => s + r.kuerzungCent, 0),
    summe_absetzbar_cent: rows.reduce((s, r) => s + r.absetzbarCent, 0),
  };
}

export interface SteuerUebersichtExport {
  year: number;
  personal: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    arbeitgeber: string;
    eintrittsdatum: string;
  };
  abwesenheit_8h_inland: number;
  an_abreise_inland: number;
  abwesenheit_24h_inland: number;
  kuerzung_inland_cent: number;
  anrechenbar_inland_cent: number;
  anrechenbar_ausland_cent: number | null;
  homeoffice_tage: number;
}

export function buildSteuerUebersicht(
  db: Db,
  year: number,
  config: AppConfig,
): SteuerUebersichtExport {
  const rates = config.ratesForYear(year);
  const yearConfig = config.raw.jahre[String(year)];
  if (!yearConfig) throw new Error(`Keine Sätze für Jahr ${year}`);

  const dbRows = daysService.listForYear(db, year);
  const { standardwoche } = getEffectiveSettings(db, config);
  const effectiveHo = computeEffectiveHomeofficeDates(year, dbRows, standardwoche);

  let abwesenheit_8h_inland = 0;
  let an_abreise_inland = 0;
  let abwesenheit_24h_inland = 0;
  let kuerzung_inland_cent = 0;
  let anrechenbar_inland_cent = 0;

  for (const d of dbRows) {
    const t = d.type as DayType;
    if (!REISE_TYPES.includes(t)) continue;
    if (t === "reise_eintaegig") abwesenheit_8h_inland += 1;
    else if (t === "reise_voll") abwesenheit_24h_inland += 1;
    else if (t === "reise_anreise" || t === "reise_abreise") an_abreise_inland += 1;
    const domain = toDomainDay(d);
    kuerzung_inland_cent += kuerzungCent(domain.meals, rates);
    anrechenbar_inland_cent += verpflegungProTagCent(domain, rates);
  }

  const p = config.raw.personal ?? {};
  return {
    year,
    personal: {
      name: p.name ?? "",
      strasse: p.strasse ?? "",
      plz: p.plz ?? "",
      ort: p.ort ?? "",
      arbeitgeber: p.arbeitgeber ?? "",
      eintrittsdatum: p.eintrittsdatum ?? "",
    },
    abwesenheit_8h_inland,
    an_abreise_inland,
    abwesenheit_24h_inland,
    kuerzung_inland_cent,
    anrechenbar_inland_cent,
    anrechenbar_ausland_cent: null,
    homeoffice_tage: effectiveHo.length,
  };
}

export function buildHomeofficeRows(db: Db, year: number, config: AppConfig): HomeofficeExport {
  const rates = config.ratesForYear(year);
  const yearConfig = config.raw.jahre[String(year)];
  if (!yearConfig) throw new Error(`Keine Sätze für Jahr ${year}`);

  const dbRows = daysService.listForYear(db, year);
  const { standardwoche } = getEffectiveSettings(db, config);
  const effectiveDates = computeEffectiveHomeofficeDates(year, dbRows, standardwoche);

  const rows: HomeofficeRow[] = effectiveDates.map((date) => ({ date }));

  return {
    year,
    rows,
    anzahl_tage: effectiveDates.length,
    betrag_pro_tag_cent: rates.homeofficeProTagCent,
    betrag_gesamt_cent: homeofficeBetragCent(
      effectiveDates.length,
      rates.homeofficeProTagCent,
      rates.homeofficeMaxCent,
    ),
    max_tage: yearConfig.homeoffice_max_tage,
    max_betrag_cent: rates.homeofficeMaxCent,
  };
}
