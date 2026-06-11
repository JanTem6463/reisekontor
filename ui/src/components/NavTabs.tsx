import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/uebersicht", labelKey: "nav.uebersicht" },
  { to: "/reisen", labelKey: "nav.reisen" },
  { to: "/export", labelKey: "nav.export" },
  { to: "/einstellungen", labelKey: "nav.einstellungen" },
] as const;

export function NavTabs() {
  const { t } = useTranslation();
  return (
    <nav className="border-b bg-background">
      <div className="container flex h-12 items-center gap-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
