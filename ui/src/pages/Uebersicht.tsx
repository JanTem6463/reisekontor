import { ReiseFormDialog } from "@/components/reisen/ReiseFormDialog";
import { KennzahlenCards } from "@/components/uebersicht/KennzahlenCards";
import { Monatskalender } from "@/components/uebersicht/Monatskalender";
import { PlausibilitaetList } from "@/components/uebersicht/PlausibilitaetList";
import { TagesdetailSheet } from "@/components/uebersicht/TagesdetailSheet";
import { YearHeatmap } from "@/components/uebersicht/YearHeatmap";
import { YearSelector } from "@/components/uebersicht/YearSelector";
import { useYear } from "@/contexts/YearContext";
import { useDays } from "@/hooks/useDays";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Uebersicht() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data: days, isLoading } = useDays(year);

  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tripFormOpen, setTripFormOpen] = useState(false);
  const [tripStartDate, setTripStartDate] = useState<string | null>(null);

  const existing = days?.find((d) => d.date === selectedDate) ?? null;

  function handleCreateTripFromDate(date: string) {
    setTripStartDate(date);
    setTripFormOpen(true);
  }

  function handleDayClick(iso: string) {
    setSelectedDate(iso);
    const parts = iso.split("-");
    const y = parts[0] ? Number.parseInt(parts[0], 10) : Number.NaN;
    const m = parts[1] ? Number.parseInt(parts[1], 10) : Number.NaN;
    if (Number.isFinite(y) && Number.isFinite(m) && (y !== year || m !== month)) {
      setMonth(m);
    }
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("pages.uebersicht.title")}</h1>
        <YearSelector />
      </div>

      <KennzahlenCards />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Monatskalender
            year={year}
            month={month}
            days={days ?? []}
            onMonthChange={(_, m) => setMonth(m)}
            onDayClick={handleDayClick}
            {...(selectedDate ? { selectedDate } : {})}
          />
        </div>
        <div>
          <PlausibilitaetList />
        </div>
      </div>

      <YearHeatmap
        year={year}
        days={days ?? []}
        isLoading={isLoading}
        onDayClick={handleDayClick}
      />

      <TagesdetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        date={selectedDate}
        existing={existing}
        onCreateTrip={handleCreateTripFromDate}
      />

      <ReiseFormDialog
        open={tripFormOpen}
        onOpenChange={setTripFormOpen}
        editTrip={null}
        {...(tripStartDate ? { initialStartDate: tripStartDate } : {})}
      />
    </div>
  );
}
