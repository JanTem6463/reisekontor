import { Button } from "@/components/ui/button";
import type { DayEntryDto } from "@/lib/api";
import { dayTypeClasses } from "@/lib/day-styles";
import { cn } from "@/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  year: number;
  month: number; // 1-12
  days: DayEntryDto[];
  onMonthChange: (year: number, month: number) => void;
  onDayClick: (iso: string) => void;
  selectedDate?: string;
}

const WEEKDAYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

export function Monatskalender({
  year,
  month,
  days,
  onMonthChange,
  onDayClick,
  selectedDate,
}: Props) {
  const { t } = useTranslation();
  const cursor = useMemo(() => new Date(year, month - 1, 1), [year, month]);

  const dayByIso = useMemo(() => {
    const map = new Map<string, DayEntryDto>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  function nav(deltaMonths: number) {
    const next = addMonths(cursor, deltaMonths);
    onMonthChange(next.getFullYear(), next.getMonth() + 1);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => nav(-1)}
          aria-label={t("kalender.prev_month")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{format(cursor, "MMMM yyyy", { locale: de })}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => nav(1)}
          aria-label={t("kalender.next_month")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center py-1">
            {t(`kalender.weekday.short.${d}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, cursor);
          const entry = dayByIso.get(iso);
          const isSelected = selectedDate === iso;
          const isKombi =
            entry?.homeoffice && (entry.type === "reise_anreise" || entry.type === "reise_abreise");
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDayClick(iso)}
              className={cn(
                "relative aspect-square rounded border text-sm transition-all",
                "hover:ring-2 hover:ring-ring",
                dayTypeClasses(entry?.type ?? null),
                !inMonth && "opacity-40",
                isSelected && "ring-2 ring-ring",
              )}
              aria-label={iso}
            >
              <span className="absolute top-1 left-2 text-xs font-medium">{format(d, "d")}</span>
              {isKombi && (
                <Home
                  className="absolute bottom-1 right-1 h-3 w-3 text-blue-300"
                  aria-label="Kombi-Tag"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
