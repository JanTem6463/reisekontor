import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayEntryDto } from "@/lib/api";
import { dayTypeClasses } from "@/lib/day-styles";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  year: number;
  days: DayEntryDto[];
  isLoading: boolean;
  onDayClick: (iso: string) => void;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function YearHeatmap({ year, days, isLoading, onDayClick }: Props) {
  const { t } = useTranslation();

  const dayByIso = useMemo(() => {
    const map = new Map<string, DayEntryDto>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("heatmap.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("heatmap.title")} {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {Array.from({ length: 12 }, (_, m) => m + 1).map((month) => {
            const dim = daysInMonth(year, month);
            const monthDate = new Date(year, month - 1, 1);
            return (
              <div key={month} className="flex items-center gap-2">
                <span className="w-12 text-xs text-muted-foreground shrink-0">
                  {format(monthDate, "MMM", { locale: de })}
                </span>
                <div className="flex gap-0.5 flex-wrap">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    if (day > dim) {
                      return <div key={day} className="w-4 h-4 opacity-0" />;
                    }
                    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const entry = dayByIso.get(iso);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onDayClick(iso)}
                        title={`${iso}${entry ? ` — ${t(`day_types.${entry.type}`)}` : ""}`}
                        className={cn(
                          "w-4 h-4 rounded-sm border transition-all hover:ring-1 hover:ring-ring",
                          dayTypeClasses(entry?.type ?? null),
                        )}
                        aria-label={iso}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
