export type DayType =
  | "homeoffice"
  | "buero"
  | "reise_anreise"
  | "reise_voll"
  | "reise_abreise"
  | "reise_eintaegig"
  | "urlaub"
  | "krankheit"
  | "feiertag";

export interface Meals {
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
}

export interface DayEntry {
  date: string; // ISO YYYY-MM-DD
  type: DayType;
  homeoffice: boolean; // Kombi-Flag: zusätzlich Homeoffice (nur bei Anreise/Abreise sinnvoll)
  meals: Meals;
  zuzahlungCent: number;
}

export interface Rates {
  kleineCent: number;
  grosseCent: number;
  kuerzFruehstueckCent: number;
  kuerzHauptCent: number;
  homeofficeProTagCent: number;
  homeofficeMaxCent: number;
}

export interface TripInput {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD (inklusiv)
  uebernachtung: boolean;
}

export interface ClassifiedDay {
  date: string;
  type: DayType;
}
