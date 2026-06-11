import Holidays from "date-holidays";
import { eq } from "drizzle-orm";
import type { AppConfig } from "../config/index.ts";
import type { Db } from "../db/client.ts";
import { settings } from "../db/schema.ts";

const KEY_BUNDESLAND = "bundesland";
const KEY_STANDARDWOCHE = "standardwoche";

export interface Standardwoche {
  mo: boolean;
  di: boolean;
  mi: boolean;
  do: boolean;
  fr: boolean;
  sa: boolean;
  so: boolean;
}

export interface EffectiveSettings {
  bundesland: string;
  standardwoche: Standardwoche;
}

export interface UpdateSettingsBody {
  bundesland?: string;
  standardwoche?: Standardwoche;
}

const VALID_DE_STATES: Set<string> = (() => {
  const states = new Holidays().getStates("DE");
  return new Set(states ? Object.keys(states) : []);
})();

function readKey(db: Db, key: string): string | null {
  const rows = db.select().from(settings).where(eq(settings.key, key)).all();
  return rows[0]?.value ?? null;
}

function writeKey(db: Db, key: string, value: string): void {
  const existing = readKey(db, key);
  if (existing === null) {
    db.insert(settings).values({ key, value }).run();
  } else {
    db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  }
}

export function getEffectiveSettings(db: Db, config: AppConfig): EffectiveSettings {
  const dbBundesland = readKey(db, KEY_BUNDESLAND);
  const dbStandardwocheJson = readKey(db, KEY_STANDARDWOCHE);
  let standardwoche: Standardwoche = config.raw.standardwoche;
  if (dbStandardwocheJson) {
    try {
      standardwoche = JSON.parse(dbStandardwocheJson) as Standardwoche;
    } catch {
      // Fallback auf Config bei korrupter Row
    }
  }
  return {
    bundesland: dbBundesland ?? config.raw.feiertage.bundesland,
    standardwoche,
  };
}

function validateBundesland(value: string): void {
  if (value.length !== 2) {
    throw new Error(`Ungültiges Bundesland (Länge ≠ 2): ${value}`);
  }
  if (!VALID_DE_STATES.has(value)) {
    throw new Error(`Ungültiges Bundesland: ${value}`);
  }
}

function validateStandardwoche(value: unknown): asserts value is Standardwoche {
  const keys = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
  if (!value || typeof value !== "object") {
    throw new Error("standardwoche muss ein Objekt sein");
  }
  for (const k of keys) {
    const v = (value as Record<string, unknown>)[k];
    if (typeof v !== "boolean") {
      throw new Error(`standardwoche.${k} muss boolean sein`);
    }
  }
}

export function updateSettings(
  db: Db,
  body: UpdateSettingsBody,
  config: AppConfig,
): EffectiveSettings {
  if (body.bundesland !== undefined) {
    validateBundesland(body.bundesland);
    writeKey(db, KEY_BUNDESLAND, body.bundesland);
  }
  if (body.standardwoche !== undefined) {
    validateStandardwoche(body.standardwoche);
    writeKey(db, KEY_STANDARDWOCHE, JSON.stringify(body.standardwoche));
  }
  return getEffectiveSettings(db, config);
}
