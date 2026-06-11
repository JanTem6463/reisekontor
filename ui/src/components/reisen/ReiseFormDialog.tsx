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
import { useYear } from "@/contexts/YearContext";
import { useCreateTrip } from "@/hooks/useCreateTrip";
import { useUpdateTrip } from "@/hooks/useUpdateTrip";
import type { TripWithDays } from "@/lib/api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HartResetWarnung } from "./HartResetWarnung";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTrip: TripWithDays | null;
}

function countManuelleMahlzeiten(days: TripWithDays["days"]): number {
  return days.filter((d) => d.fruehstueck || d.mittag || d.abend || d.zuzahlungCent > 0).length;
}

export function ReiseFormDialog({ open, onOpenChange, editTrip }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const create = useCreateTrip(year);
  const update = useUpdateTrip(year);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uebernachtung, setUebernachtung] = useState(true);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnCount, setWarnCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (editTrip) {
      setStartDate(editTrip.trip.startDate);
      setEndDate(editTrip.trip.endDate);
      setUebernachtung(editTrip.trip.uebernachtung);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(today);
      setUebernachtung(true);
    }
  }, [open, editTrip]);

  async function doSubmit() {
    const body = { startDate, endDate, uebernachtung };
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTrip ? t("reisen.form.edit_title") : t("reisen.form.create_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start">{t("reisen.form.start_date")}</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">{t("reisen.form.end_date")}</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
