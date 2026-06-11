import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useYear } from "@/contexts/YearContext";
import { ApiError, type ExportFormat, type ExportKind, downloadExport } from "@/lib/api";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
  kind: ExportKind;
}

const FORMATS: ExportFormat[] = ["pdf", "xlsx", "csv"];

export function ExportPanel({ kind }: Props) {
  const { t } = useTranslation();
  const { year } = useYear();
  const [pending, setPending] = useState<ExportFormat | null>(null);

  async function handle(format: ExportFormat) {
    setPending(format);
    try {
      await downloadExport(kind, year, format);
      toast.success(t("export.toast.success"));
    } catch (err) {
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        toast.error(t(key, { defaultValue: t("errors.unknown") }));
      } else {
        toast.error(t("errors.network"));
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`export.${kind}.title`)}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{t(`export.${kind}.description`)}</p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <Button key={f} variant="outline" onClick={() => handle(f)} disabled={pending !== null}>
              <Download className="h-4 w-4 mr-2" />
              {t(`export.format.${f}`)}
              {pending === f ? "…" : ""}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
