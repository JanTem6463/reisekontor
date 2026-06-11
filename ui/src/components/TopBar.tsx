import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getStoredTheme, toggleTheme, type Theme } from "@/lib/theme";

export function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<Theme>(getStoredTheme());

  function handleThemeToggle() {
    setThemeState(toggleTheme());
  }

  function handleLanguageChange(lang: "de" | "en") {
    void i18n.changeLanguage(lang);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Logout idempotent — Fehler ignorieren
    }
    navigate("/login", { replace: true });
  }

  return (
    <header className="border-b bg-background">
      <div className="container flex h-14 items-center justify-between">
        <div className="font-semibold">Reisekontor</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <Button
              variant={i18n.resolvedLanguage === "de" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleLanguageChange("de")}
            >
              DE
            </Button>
            <Button
              variant={i18n.resolvedLanguage === "en" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleLanguageChange("en")}
            >
              EN
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            aria-label={t("common.theme.toggle")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label={t("common.logout")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
