import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useYear } from "@/contexts/YearContext";
import { useCreateTrip } from "@/hooks/useCreateTrip";
import { useUpdateTrip } from "@/hooks/useUpdateTrip";
import type { TripDayOverride, TripWithDays } from "@/lib/api";
import { classifyTripPreview } from "@/lib/trip-preview";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HartResetWarnung } from "./HartResetWarnung";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTrip: TripWithDays | null;
}

type RowState = {
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungEur: string;
  homeoffice: boolean;
};

function countManuelleMahlzeiten(days: TripWithDays["days"]): number {
  return days.filter((d) => d.fruehstueck || d.mittag || d.abend || d.zuzahlungCent > 0).length;
}

function centToEur(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",");
}

function defaultRow(): RowState {
  return {
    fruehstueck: false,
    mittag: false,
    abend: false,
    zuzahlungEur: "0,00",
    homeoffice: false,
  };
}

export function ReiseFormDialog({ open, onOpenChange, editTrip }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const create = useCreateTrip(year);
  const update = useUpdateTrip(year);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [uebernachtung, setUebernachtung] = useState(true);
  const [rowsByDate, setRowsByDate] = useState<Record<string, RowState>>({});
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnCount, setWarnCount] = useState(0);

  // Beim Ändern von startDate end-Datum mitziehen, solange User es nicht
  // explizit angefasst hat. Verhindert dass beim Anlegen einer Vergangenheits-
  // Reise (z.B. startDate = 01.03., endDate noch default = today) eine
  // dreistellige Tagesliste erzeugt wird, die das endDate-Feld verdeckt.
  function handleStartDateChange(v: string) {
    setStartDate(v);
    if (!endDateTouched) setEndDate(v);
  }
  function handleEndDateChange(v: string) {
    setEndDate(v);
    setEndDateTouched(true);
  }

  useEffect(() => {
    if (!open) return;
    if (editTrip) {
      setStartDate(editTrip.trip.startDate);
      setEndDate(editTrip.trip.endDate);
      setEndDateTouched(true);
      setUebernachtung(editTrip.trip.uebernachtung);
      const map: Record<string, RowState> = {};
      for (const d of editTrip.days) {
        map[d.date] = {
          fruehstueck: d.fruehstueck,
          mittag: d.mittag,
          abend: d.abend,
          zuzahlungEur: centToEur(d.zuzahlungCent),
          homeoffice: d.homeoffice,
        };
      }
      setRowsByDate(map);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(today);
      setEndDateTouched(false);
      setUebernachtung(true);
      setRowsByDate({});
    }
  }, [open, editTrip]);

  const preview = useMemo(
    () => classifyTripPreview(startDate, endDate, uebernachtung),
    [startDate, endDate, uebernachtung],
  );

  function getRow(date: string): RowState {
    return rowsByDate[date] ?? defaultRow();
  }

  function setRow(date: string, updater: (prev: RowState) => RowState) {
    setRowsByDate((m) => ({ ...m, [date]: updater(m[date] ?? defaultRow()) }));
  }

  async function doSubmit() {
    const days: TripDayOverride[] =
      preview?.map((p) => {
        const r = getRow(p.date);
        const zuzahlungCent = Math.round(
          Number.parseFloat(r.zuzahlungEur.replace(",", ".") || "0") * 100,
        );
        const out: TripDayOverride = { date: p.date };
        if (r.fruehstueck) out.fruehstueck = true;
        if (r.mittag) out.mittag = true;
        if (r.abend) out.abend = true;
        if (Number.isFinite(zuzahlungCent) && zuzahlungCent > 0) {
          out.zuzahlungCent = zuzahlungCent;
        }
        if (r.homeoffice && (p.type === "reise_anreise" || p.type === "reise_abreise")) {
          out.homeoffice = true;
        }
        return out;
      }) ?? [];

    const body = { startDate, endDate, uebernachtung, days };
    try {
      if (editTrip) {
        await update.mutateAsync({ id: editTrip.trip.id, body });
        toast.success(t("reisen.toast.updated"));
      } else {
        await create.mutateAsync(body);
        toast.success(t("reisen.toast.created"));
      }
      onOpenChange(false);
    } catch {
      // Toast kommt aus dem Hook-onError
    }
  }

  function handleSave() {
    if (editTrip) {
      const c = countManuelleMahlzeiten(editTrip.days);
      if (c > 0) {
        setWarnCount(c);
        setWarnOpen(true);
        return;
      }
    }
    void doSubmit();
  }

  function handleWarnConfirm() {
    setWarnOpen(false);
    void doSubmit();
  }

  const pending = create.isPending || update.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editTrip ? t("reisen.form.edit_title") : t("reisen.form.create_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start">{t("reisen.form.start_date")}</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">{t("reisen.form.end_date")}</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uebernachtung"
                checked={uebernachtung}
                onCheckedChange={(c) => setUebernachtung(c === true)}
              />
              <Label htmlFor="uebernachtung">{t("reisen.form.uebernachtung_label")}</Label>
            </div>
            {preview && preview.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label>{t("reisen.form.days_table_label")}</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reisen.form.col.date")}</TableHead>
                      <TableHead>{t("reisen.form.col.type")}</TableHead>
                      <TableHead className="text-center">{t("meals.fruehstueck")}</TableHead>
                      <TableHead className="text-center">{t("meals.mittag")}</TableHead>
                      <TableHead className="text-center">{t("meals.abend")}</TableHead>
                      <TableHead>{t("reisen.form.col.zuzahlung")}</TableHead>
                      <TableHead className="text-center">{t("reisen.form.col.ho_combo")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((p) => {
                      const r = getRow(p.date);
                      const isCombo = p.type === "reise_anreise" || p.type === "reise_abreise";
                      return (
                        <TableRow key={p.date}>
                          <TableCell>{p.date}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {t(`day_types.${p.type}`)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={r.fruehstueck}
                              onCheckedChange={(c) =>
                                setRow(p.date, (prev) => ({
                                  ...prev,
                                  fruehstueck: c === true,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={r.mittag}
                              onCheckedChange={(c) =>
                                setRow(p.date, (prev) => ({ ...prev, mittag: c === true }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={r.abend}
                              onCheckedChange={(c) =>
                                setRow(p.date, (prev) => ({ ...prev, abend: c === true }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={r.zuzahlungEur}
                              onChange={(e) =>
                                setRow(p.date, (prev) => ({
                                  ...prev,
                                  zuzahlungEur: e.target.value,
                                }))
                              }
                              className="h-7 w-20"
                              placeholder="0,00"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {isCombo ? (
                              <Checkbox
                                checked={r.homeoffice}
                                onCheckedChange={(c) =>
                                  setRow(p.date, (prev) => ({
                                    ...prev,
                                    homeoffice: c === true,
                                  }))
                                }
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("reisen.form.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={pending}>
              {t("reisen.form.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HartResetWarnung
        open={warnOpen}
        onOpenChange={setWarnOpen}
        count={warnCount}
        onConfirm={handleWarnConfirm}
      />
    </>
  );
}
