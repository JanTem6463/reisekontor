import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useYear } from "@/contexts/YearContext";
import { useDeleteTrip } from "@/hooks/useDeleteTrip";
import type { TripDto } from "@/lib/api";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripDto | null;
}

export function ReiseDeleteDialog({ open, onOpenChange, trip }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const del = useDeleteTrip(year);

  async function handleConfirm() {
    if (!trip) return;
    try {
      await del.mutateAsync(trip.id);
      toast.success(t("reisen.toast.deleted"));
      onOpenChange(false);
    } catch {
      // Error-Toast aus dem Hook
    }
  }

  if (!trip) return null;

  const startDisplay = format(new Date(trip.startDate), "d. MMM yyyy", { locale: de });
  const endDisplay = format(new Date(trip.endDate), "d. MMM yyyy", { locale: de });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reisen.delete_dialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("reisen.delete_dialog.body", { start: startDisplay, end: endDisplay })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("reisen.delete_dialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={del.isPending}>
            {t("reisen.delete_dialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
