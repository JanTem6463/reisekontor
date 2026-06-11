import { describe, expect, it } from "vitest";
import { formatEur } from "./money.ts";

describe("formatEur", () => {
  it("formatiert null Cent als 0,00 €", () => {
    expect(formatEur(0)).toBe("0,00 €");
  });

  it("formatiert ganze Euro", () => {
    expect(formatEur(1400)).toBe("14,00 €");
  });

  it("formatiert Beträge mit Cent", () => {
    expect(formatEur(1680)).toBe("16,80 €");
  });

  it("formatiert Tausender mit Punkt", () => {
    expect(formatEur(126000)).toBe("1.260,00 €");
  });

  it("formatiert negative Beträge", () => {
    expect(formatEur(-560)).toBe("-5,60 €");
  });
});
