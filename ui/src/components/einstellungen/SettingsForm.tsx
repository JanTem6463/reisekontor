import { BundeslandSelect } from "@/components/einstellungen/BundeslandSelect";
import { StandardwocheCheckboxes } from "@/components/einstellungen/StandardwocheCheckboxes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useYear } from "@/contexts/YearContext";
import { useSettings } from "@/hooks/useSettings";
import { useSyncHolidays } from "@/hooks/useSyncHolidays";
import { useUpdateSettings } from "@/hooks/useUpdateSettings";
import type { Standardwoche } from "@/lib/api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function SettingsForm() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const syncHolidays = useSyncHolidays();

  const [bundesland, setBundesland] = useState("");
  const [standardwoche, setStandardwoche] = useState<Standardwoche>({
    mo: true,
    di: true,
    mi: true,
    do: true,
    fr: true,
    sa: false,
    so: false,
  });

  useEffect(() => {
    if (!data) return;
    setBundesland(data.bundesland);
    setStandardwoche(data.standardwoche);
  }, [data]);

  async function handleSave() {
    if (!data) return;
    const bundeslandChanged = bundesland !== data.bundesland;
    try {
      await updateSettings.mutateAsync({ bundesland, standardwoche });
      toast.success(t("einstellungen.toast.saved"));
      if (bundeslandChanged) {
        try {
          const result = await syncHolidays.mutateAsync(year);
          toast.success(t("einstellungen.toast.holidays_synced", { count: result.created }));
        } catch {
          toast.warning(t("einstellungen.toast.holidays_sync_failed"));
        }
      }
    } catch {
      // Error-Toast aus useUpdateSettings.onError
    }
  }

  async function handleResync() {
    try {
      const result = await syncHolidays.mutateAsync(year);
      toast.success(t("einstellungen.toast.holidays_synced", { count: result.created }));
    } catch {
      // Error-Toast aus dem Hook
    }
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const pending = updateSettings.isPending || syncHolidays.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.einstellungen.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t("einstellungen.bundesland_label")}</Label>
          <BundeslandSelect value={bundesland} onChange={setBundesland} />
        </div>

        <div className="space-y-2">
          <Label>{t("einstellungen.standardwoche_label")}</Label>
          <StandardwocheCheckboxes value={standardwoche} onChange={setStandardwoche} />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={pending}>
            {t("einstellungen.save")}
          </Button>
          <Button variant="outline" onClick={handleResync} disabled={pending}>
            {t("einstellungen.holidays_resync_button")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
