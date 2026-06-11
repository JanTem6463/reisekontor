import type { Db } from "../db/client.ts";
import { type PlausibilitaetHinweis, checkAll } from "../domain/plausibilitaet.ts";
import * as daysService from "./days.ts";
import { toDomainDay } from "./mappers.ts";

export function checkYear(db: Db, year: number): PlausibilitaetHinweis[] {
  const rows = daysService.listForYear(db, year);
  const domainDays = rows.map(toDomainDay);
  return checkAll(domainDays);
}
