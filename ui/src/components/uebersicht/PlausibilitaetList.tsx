import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useYear } from "@/contexts/YearContext";
import { useChecks } from "@/hooks/useChecks";
import { AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

const SCHWERE_ORDER: Record<"warnung" | "hinweis", number> = { warnung: 0, hinweis: 1 };

export function PlausibilitaetList() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data, isLoading } = useChecks(year);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("checks.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("checks.empty")}</p>
        ) : (
          <ScrollArea className="max-h-72">
            <ul className="space-y-2">
              {[...data]
                .sort(
                  (a, b) =>
                    SCHWERE_ORDER[a.schwere] - SCHWERE_ORDER[b.schwere] ||
                    a.date.localeCompare(b.date),
                )
                .map((h, i) => (
                  <li key={`${h.code}-${h.date}-${i}`} className="flex items-start gap-2 text-sm">
                    {h.schwere === "warnung" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 text-amber-500" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={h.schwere === "warnung" ? "destructive" : "secondary"}>
                          {h.date}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{t(`checks.codes.${h.code}`)}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
