import type { DayType } from "./api";

export const DAY_TYPE_LABELS_DE: Record<DayType, string> = {
  homeoffice: "Homeoffice",
  buero: "Büro",
  reise_anreise: "Reise – Anreise",
  reise_voll: "Reise – voller Tag",
  reise_abreise: "Reise – Abreise",
  reise_eintaegig: "Reise – eintägig",
  urlaub: "Urlaub",
  krankheit: "Krankheit",
  feiertag: "Feiertag",
};

const COLORS: Record<DayType, string> = {
  homeoffice: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  buero: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  reise_anreise: "bg-orange-500/30 text-orange-300 border-orange-500/50",
  reise_voll: "bg-red-500/30 text-red-300 border-red-500/50",
  reise_abreise: "bg-orange-500/30 text-orange-300 border-orange-500/50",
  reise_eintaegig: "bg-amber-500/30 text-amber-300 border-amber-500/50",
  urlaub: "bg-green-500/20 text-green-300 border-green-500/40",
  krankheit: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  feiertag: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

export function dayTypeClasses(type: DayType | null): string {
  if (!type) return "border-border bg-transparent text-muted-foreground";
  return COLORS[type] ?? "";
}

export const REISE_TYPES: ReadonlyArray<DayType> = [
  "reise_anreise",
  "reise_voll",
  "reise_abreise",
  "reise_eintaegig",
];

export function isReiseType(type: DayType): boolean {
  return REISE_TYPES.includes(type);
}
