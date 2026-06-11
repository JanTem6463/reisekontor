import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEur } from "@/lib/money-format";
import { useTranslation } from "react-i18next";

const RATES_2026 = {
  kleine_cent: 1400,
  grosse_cent: 2800,
  kuerz_fruehstueck_cent: 560,
  kuerz_haupt_cent: 1120,
  homeoffice_pro_tag_cent: 600,
  homeoffice_max_tage: 210,
  homeoffice_max_cent: 126000,
} as const;

export function PauschalenAnzeige() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("einstellungen.pauschalen_title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row
            label={t("einstellungen.pauschalen.kleine")}
            value={formatEur(RATES_2026.kleine_cent)}
          />
          <Row
            label={t("einstellungen.pauschalen.grosse")}
            value={formatEur(RATES_2026.grosse_cent)}
          />
          <Row
            label={t("einstellungen.pauschalen.kuerz_fruehstueck")}
            value={formatEur(RATES_2026.kuerz_fruehstueck_cent)}
          />
          <Row
            label={t("einstellungen.pauschalen.kuerz_haupt")}
            value={formatEur(RATES_2026.kuerz_haupt_cent)}
          />
          <Row
            label={t("einstellungen.pauschalen.homeoffice_pro_tag")}
            value={formatEur(RATES_2026.homeoffice_pro_tag_cent)}
          />
          <Row
            label={t("einstellungen.pauschalen.homeoffice_max_tage")}
            value={String(RATES_2026.homeoffice_max_tage)}
          />
          <Row
            label={t("einstellungen.pauschalen.homeoffice_max")}
            value={formatEur(RATES_2026.homeoffice_max_cent)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
