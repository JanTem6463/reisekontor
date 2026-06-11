import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./index.ts";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "rk-config-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function writeConfig(content: string): string {
  const path = join(tmp, "app.yaml");
  writeFileSync(path, content, "utf8");
  return path;
}

const validYaml = `
jahre:
  "2026":
    kleine_cent: 1400
    grosse_cent: 2800
    kuerz_fruehstueck_cent: 560
    kuerz_haupt_cent: 1120
    homeoffice_pro_tag_cent: 600
    homeoffice_max_tage: 210
    homeoffice_max_cent: 126000
standardwoche:
  mo: true
  di: true
  mi: true
  do: true
  fr: true
  sa: false
  so: false
feiertage:
  bundesland: NI
`;

describe("loadConfig", () => {
  it("lädt eine gültige YAML", () => {
    const cfg = loadConfig(writeConfig(validYaml));
    expect(cfg.raw.feiertage.bundesland).toBe("NI");
    expect(cfg.raw.standardwoche.mo).toBe(true);
  });

  it("wirft mit klarer Message bei fehlendem Pflicht-Feld", () => {
    const broken = validYaml.replace("kleine_cent: 1400", "");
    expect(() => loadConfig(writeConfig(broken))).toThrow(/kleine_cent/);
  });

  it("wirft mit klarer Message bei falschem Typ", () => {
    const broken = validYaml.replace("kleine_cent: 1400", "kleine_cent: -100");
    expect(() => loadConfig(writeConfig(broken))).toThrow(/kleine_cent/);
  });

  it("wirft, wenn Bundesland nicht 2 Zeichen hat", () => {
    const broken = validYaml.replace("bundesland: NI", "bundesland: Niedersachsen");
    expect(() => loadConfig(writeConfig(broken))).toThrow(/bundesland/);
  });

  it("wirft bei nicht-existenter Datei", () => {
    expect(() => loadConfig(join(tmp, "does-not-exist.yaml"))).toThrow();
  });
});

describe("AppConfig.ratesForYear", () => {
  it("liefert Rates in Cent für ein vorhandenes Jahr", () => {
    const cfg = loadConfig(writeConfig(validYaml));
    const rates = cfg.ratesForYear(2026);
    expect(rates).toEqual({
      kleineCent: 1400,
      grosseCent: 2800,
      kuerzFruehstueckCent: 560,
      kuerzHauptCent: 1120,
      homeofficeProTagCent: 600,
      homeofficeMaxCent: 126000,
    });
  });

  it("wirft mit klarer Message für nicht hinterlegtes Jahr", () => {
    const cfg = loadConfig(writeConfig(validYaml));
    expect(() => cfg.ratesForYear(2099)).toThrow(/2099/);
  });
});
