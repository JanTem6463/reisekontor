import { ReiseDeleteDialog } from "@/components/reisen/ReiseDeleteDialog";
import { ReiseFormDialog } from "@/components/reisen/ReiseFormDialog";
import { ReisenList } from "@/components/reisen/ReisenList";
import { YearSelector } from "@/components/uebersicht/YearSelector";
import type { TripWithDays } from "@/lib/api";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Reisen() {
  const { t } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<TripWithDays | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTrip, setDeleteTrip] = useState<TripWithDays | null>(null);

  function handleCreate() {
    setEditTrip(null);
    setFormOpen(true);
  }
  function handleEdit(trip: TripWithDays) {
    setEditTrip(trip);
    setFormOpen(true);
  }
  function handleDelete(trip: TripWithDays) {
    setDeleteTrip(trip);
    setDeleteOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("pages.reisen.title")}</h1>
        <YearSelector />
      </div>

      <ReisenList onCreate={handleCreate} onEdit={handleEdit} onDelete={handleDelete} />

      <ReiseFormDialog open={formOpen} onOpenChange={setFormOpen} editTrip={editTrip} />
      <ReiseDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        trip={deleteTrip?.trip ?? null}
      />
    </div>
  );
}
