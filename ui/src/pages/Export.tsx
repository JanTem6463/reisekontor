import { ExportPanel } from "@/components/export/ExportPanel";
import { YearSelector } from "@/components/uebersicht/YearSelector";
import { useTranslation } from "react-i18next";

export default function Export() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("pages.export.title")}</h1>
        <YearSelector />
      </div>
      <ExportPanel kind="steuer" />
      <ExportPanel kind="reisekosten" />
      <ExportPanel kind="homeoffice" />
    </div>
  );
}
