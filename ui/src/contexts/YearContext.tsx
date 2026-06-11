import { type ReactNode, createContext, useContext, useState } from "react";

const STORAGE_KEY = "rk-year";
const DEFAULT_YEAR = 2026;

interface YearContextValue {
  year: number;
  setYear: (y: number) => void;
}

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number.parseInt(stored, 10);
      if (Number.isFinite(n) && n >= 2020 && n <= 2100) return n;
    }
    return DEFAULT_YEAR;
  });

  function setYear(y: number) {
    localStorage.setItem(STORAGE_KEY, String(y));
    setYearState(y);
  }

  return <YearContext.Provider value={{ year, setYear }}>{children}</YearContext.Provider>;
}

export function useYear(): YearContextValue {
  const v = useContext(YearContext);
  if (!v) throw new Error("useYear muss innerhalb YearProvider gerufen werden");
  return v;
}
