import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYear } from "@/contexts/YearContext";
import { useTranslation } from "react-i18next";

const AVAILABLE_YEARS = [2024, 2025, 2026];

export function YearSelector() {
  const { t } = useTranslation();
  const { year, setYear } = useYear();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t("year_selector.label")}</span>
      <Select value={String(year)} onValueChange={(v) => setYear(Number.parseInt(v, 10))}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
