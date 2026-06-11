import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { Rates } from "../domain/types.ts";
import { type Config, ConfigSchema } from "./schema.ts";

export interface AppConfig {
  raw: Config;
  ratesForYear(year: number): Rates;
}

export function loadConfig(path: string): AppConfig {
  const yamlText = readFileSync(path, "utf8");
  const parsed = parseYaml(yamlText);
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config-Datei ${path} ungültig: ${issues}`);
  }
  const cfg = result.data;
  return {
    raw: cfg,
    ratesForYear(year: number): Rates {
      const key = String(year);
      const y = cfg.jahre[key];
      if (!y) {
        throw new Error(
          `Keine Sätze für Jahr ${year} hinterlegt. Verfügbar: ${Object.keys(cfg.jahre).join(", ")}`,
        );
      }
      return {
        kleineCent: y.kleine_cent,
        grosseCent: y.grosse_cent,
        kuerzFruehstueckCent: y.kuerz_fruehstueck_cent,
        kuerzHauptCent: y.kuerz_haupt_cent,
        homeofficeProTagCent: y.homeoffice_pro_tag_cent,
        homeofficeMaxCent: y.homeoffice_max_cent,
      };
    },
  };
}
