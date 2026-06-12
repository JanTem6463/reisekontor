import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useYear } from "@/contexts/YearContext";
import { useDeleteDay } from "@/hooks/useDeleteDay";
import { useUpsertDay } from "@/hooks/useUpsertDay";
import type { DayEntryDto, DayType } from "@/lib/api";
import { isReiseType } from "@/lib/day-styles";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const NON_REISE_TYPES: DayType[] = ["homeoffice", "buero", "urlaub", "krankheit", "feiertag"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  existing: DayEntryDto | null;
  onCreateTrip?: (date: string) => void;
}

export function TagesdetailSheet({ open, onOpenChange, date, existing, onCreateTrip }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const upsert = useUpsertDay(year);
  const del = useDeleteDay(year);

  const [type, setType] = useState<DayType>("homeoffice");
  const [homeoffice, setHomeoffice] = useState(false);
  const [fruehstueck, setFruehstueck] = useState(false);
  const [mittag, setMittag] = useState(false);
  const [abend, setAbend] = useState(false);
  const [zuzahlungEur, setZuzahlungEur] = useState("0,00");

  useEffect(() => {
    if (!open || !date) return;
    if (existing) {
      setType(existing.type);
      setHomeoffice(existing.homeoffice);
      setFruehstueck(existing.fruehstueck);
      setMittag(existing.mittag);
      setAbend(existing.abend);
      setZuzahlungEur((existing.zuzahlungCent / 100).toFixed(2).replace(".", ","));
    } else {
      setType("homeoffice");
      setHomeoffice(false);
      setFruehstueck(false);
      setMittag(false);
      setAbend(false);
      setZuzahlungEur("0,00");
    }
  }, [open, date, existing]);

  if (!date) return null;

  const isTripDay = existing?.tripId !== null && existing?.tripId !== undefined;
  const showMealsAndHo = isReiseType(type);

  async function handleSave() {
    if (!date) return;
    const parsed = Number.parseFloat(zuzahlungEur.replace(",", ".") || "0");
    const zuzahlungCent = Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    try {
      await upsert.mutateAsync({
        date,
        body: {
          type,
          homeoffice: isReiseType(type) ? homeoffice : false,
          tripId: existing?.tripId ?? null,
          meals: isReiseType(type)
            ? { fruehstueck, mittag, abend }
            : { fruehstueck: false, mittag: false, abend: false },
          zuzahlungCent: isReiseType(type) ? zuzahlungCent : 0,
        },
      });
      toast.success(t("tagesdetail.saved"));
      onOpenChange(false);
    } catch {
      // Fehler-Toast kommt aus useUpsertDay.onError
    }
  }

  async function handleDelete() {
    if (!date) return;
    try {
      await del.mutateAsync(date);
      toast.success(t("tagesdetail.deleted"));
      onOpenChange(false);
    } catch {
      // Fehler-Toast kommt aus useDeleteDay.onError
    }
  }

  const dateDisplay = format(new Date(date), "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{dateDisplay}</SheetTitle>
          {isTripDay && (
            <SheetDescription className="text-amber-500">
              {t("tagesdetail.trip_locked_hint")}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("tagesdetail.type_label")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as DayType)} disabled={isTripDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NON_REISE_TYPES.map((tt) => (
                  <SelectItem key={tt} value={tt}>
                    {t(`day_types.${tt}`)}
                  </SelectItem>
                ))}
                {isTripDay && (
                  <>
                    <SelectItem value="reise_anreise">{t("day_types.reise_anreise")}</SelectItem>
                    <SelectItem value="reise_voll">{t("day_types.reise_voll")}</SelectItem>
                    <SelectItem value="reise_abreise">{t("day_types.reise_abreise")}</SelectItem>
                    <SelectItem value="reise_eintaegig">
                      {t("day_types.reise_eintaegig")}
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {showMealsAndHo && (
            <>
              {(type === "reise_anreise" || type === "reise_abreise") && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="homeoffice"
                    checked={homeoffice}
                    onCheckedChange={(c) => setHomeoffice(c === true)}
                  />
                  <Label htmlFor="homeoffice">{t("tagesdetail.homeoffice_combo_label")}</Label>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("tagesdetail.meals_label")}</Label>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fruehstueck"
                      checked={fruehstueck}
                      onCheckedChange={(c) => setFruehstueck(c === true)}
                    />
                    <Label htmlFor="fruehstueck">{t("meals.fruehstueck")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mittag"
                      checked={mittag}
                      onCheckedChange={(c) => setMittag(c === true)}
                    />
                    <Label htmlFor="mittag">{t("meals.mittag")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="abend"
                      checked={abend}
                      onCheckedChange={(c) => setAbend(c === true)}
                    />
                    <Label htmlFor="abend">{t("meals.abend")}</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zuzahlung">{t("tagesdetail.zuzahlung_label")}</Label>
                <Input
                  id="zuzahlung"
                  type="text"
                  inputMode="decimal"
                  value={zuzahlungEur}
                  onChange={(e) => setZuzahlungEur(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4 flex-wrap">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {t("tagesdetail.save")}
            </Button>
            {existing && !isTripDay && (
              <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
                {t("tagesdetail.delete")}
              </Button>
            )}
            {!existing && onCreateTrip && date && (
              <Button
                variant="outline"
                onClick={() => {
                  onCreateTrip(date);
                  onOpenChange(false);
                }}
              >
                {t("tagesdetail.create_trip")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("tagesdetail.cancel")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
