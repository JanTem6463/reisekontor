import type { AppConfig } from "../config/index.ts";
import type { Db } from "../db/client.ts";
import { kuerzungCent, verpflegungProTagCent } from "../domain/pauschalen.ts";
import type { DayType } from "../domain/types.ts";
import * as daysService from "./days.ts";
import { computeEffectiveHomeofficeDates, homeofficeBetragCent } from "./effective-days.ts";
import { toDomainDay } from "./mappers.ts";
import { getEffectiveSettings } from "./settings.ts";
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

const REISE_TYPES: DayType[] = ["reise_anreise", "reise_voll", "reise_abreise", "reise_eintaegig"];

export function computeSummary(db: Db, year: number, config: AppConfig): YearSummary {
  const rates = config.ratesForYear(year);
  const yearConfig = config.raw.jahre[String(year)];
  if (!yearConfig) throw new Error(`Keine Sätze für Jahr ${year}`);

  const dayRows = daysService.listForYear(db, year);
  const domainDays = dayRows.map(toDomainDay);
  const tripRows = tripsService.listForYear(db, year);
  const { standardwoche } = getEffectiveSettings(db, config);
  const effectiveHo = computeEffectiveHomeofficeDates(year, dayRows, standardwoche);

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
    homeofficeTage: effectiveHo.length,
    homeofficeMaxTage: yearConfig.homeoffice_max_tage,
    homeofficeBetragCent: homeofficeBetragCent(
      effectiveHo.length,
      rates.homeofficeProTagCent,
      rates.homeofficeMaxCent,
    ),
    homeofficeMaxBetragCent: rates.homeofficeMaxCent,
    reisetageNachTyp,
    reisenAnzahl: tripRows.length,
  };
}
