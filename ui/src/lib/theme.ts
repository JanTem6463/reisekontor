export type Theme = "dark" | "light";

const STORAGE_KEY = "rk-theme";

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function toggleTheme(): Theme {
  const next = getStoredTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
