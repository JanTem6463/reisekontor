import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useYear } from "@/contexts/YearContext";
import { useTrips } from "@/hooks/useTrips";
import type { TripWithDays } from "@/lib/api";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  onCreate: () => void;
  onEdit: (trip: TripWithDays) => void;
  onDelete: (trip: TripWithDays) => void;
}

export function ReisenList({ onCreate, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data, isLoading } = useTrips(year);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("pages.reisen.title")}</CardTitle>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("reisen.new")}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reisen.list.empty", { year })}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reisen.list.col.start")}</TableHead>
                <TableHead>{t("reisen.list.col.end")}</TableHead>
                <TableHead className="text-right">{t("reisen.list.col.tage")}</TableHead>
                <TableHead>{t("reisen.list.col.uebernachtung")}</TableHead>
                <TableHead className="text-right">{t("reisen.list.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data]
                .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate))
                .map((tw) => (
                  <TableRow key={tw.trip.id}>
                    <TableCell>
                      {format(new Date(tw.trip.startDate), "d. MMM yyyy", { locale: de })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(tw.trip.endDate), "d. MMM yyyy", { locale: de })}
                    </TableCell>
                    <TableCell className="text-right">{tw.days.length}</TableCell>
                    <TableCell>
                      {tw.trip.uebernachtung
                        ? t("reisen.list.col.uebernachtung_yes")
                        : t("reisen.list.col.uebernachtung_no")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(tw)}
                          aria-label={t("reisen.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(tw)}
                          aria-label={t("reisen.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
