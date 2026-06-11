import type { DayEntry } from "./types.ts";

export type PlausibilitaetCode =
  | "DOPPEL_HO_REISE_VOLL"
  | "EINTAEGIG_8H_BESTAETIGEN"
  | "HO_KONFLIKT_ENTFERNUNG";

export type Schweregrad = "hinweis" | "warnung";

export interface PlausibilitaetHinweis {
  code: PlausibilitaetCode;
  date: string;
  schwere: Schweregrad;
}

/**
 * Liest die Tagesliste und liefert offene Plausibilitäts-Hinweise.
 * Mutiert nichts. Texte kommen später in der UI über i18n.
 */
export function checkAll(days: DayEntry[]): PlausibilitaetHinweis[] {
  const result: PlausibilitaetHinweis[] = [];
  for (const d of days) {
    if (d.type === "reise_voll" && d.homeoffice) {
      result.push({ code: "DOPPEL_HO_REISE_VOLL", date: d.date, schwere: "warnung" });
    }
    if (d.type === "reise_eintaegig") {
      result.push({ code: "EINTAEGIG_8H_BESTAETIGEN", date: d.date, schwere: "hinweis" });
    }
    if (
      d.type === "homeoffice" ||
      ((d.type === "reise_anreise" || d.type === "reise_abreise") && d.homeoffice)
    ) {
      result.push({ code: "HO_KONFLIKT_ENTFERNUNG", date: d.date, schwere: "hinweis" });
    }
  }
  return result;
}
