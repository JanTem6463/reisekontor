import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useYear } from "@/contexts/YearContext";
import { useSummary } from "@/hooks/useSummary";
import { formatEur } from "@/lib/money-format";
import { Briefcase, Home, Plane, Receipt, Scissors, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

function Cell({
  icon,
  title,
  value,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {value !== undefined && <div className="text-2xl font-bold">{value}</div>}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

export function KennzahlenCards() {
  const { t } = useTranslation();
  const { year } = useYear();
  const { data, isLoading } = useSummary(year);

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {["verpflegung", "kuerzung", "ho-tage", "ho-betrag", "reisen", "reisetage"].map((k) => (
          <Skeleton key={k} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const reisetageGesamt = Object.values(data.reisetageNachTyp).reduce((a, b) => a + b, 0);
  const hoPct =
    data.homeofficeMaxTage > 0
      ? Math.round((data.homeofficeTage / data.homeofficeMaxTage) * 100)
      : 0;
  const hoEurPct =
    data.homeofficeMaxBetragCent > 0
      ? Math.round((data.homeofficeBetragCent / data.homeofficeMaxBetragCent) * 100)
      : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Cell
        icon={<Receipt className="h-4 w-4" />}
        title={t("kennzahlen.verpflegung.label")}
        value={formatEur(data.verpflegungSummeCent)}
        subtitle={t("kennzahlen.verpflegung.subtitle")}
      />
      <Cell
        icon={<Scissors className="h-4 w-4" />}
        title={t("kennzahlen.kuerzung.label")}
        value={formatEur(data.kuerzungSummeCent)}
        subtitle={t("kennzahlen.kuerzung.subtitle")}
      />
      <Cell icon={<Home className="h-4 w-4" />} title={t("kennzahlen.homeoffice_tage.label")}>
        <div className="text-2xl font-bold">
          {data.homeofficeTage} / {data.homeofficeMaxTage}
        </div>
        <Progress value={hoPct} className="mt-2" />
      </Cell>
      <Cell
        icon={<TrendingUp className="h-4 w-4" />}
        title={t("kennzahlen.homeoffice_betrag.label")}
      >
        <div className="text-2xl font-bold">{formatEur(data.homeofficeBetragCent)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {t("kennzahlen.homeoffice_betrag.subtitle", {
            max: formatEur(data.homeofficeMaxBetragCent),
          })}
        </p>
        <Progress value={hoEurPct} className="mt-2" />
      </Cell>
      <Cell
        icon={<Plane className="h-4 w-4" />}
        title={t("kennzahlen.reisen_anzahl.label")}
        value={String(data.reisenAnzahl)}
        subtitle={t("kennzahlen.reisen_anzahl.subtitle")}
      />
      <Cell
        icon={<Briefcase className="h-4 w-4" />}
        title={t("kennzahlen.reisetage_gesamt.label")}
        value={String(reisetageGesamt)}
        subtitle={t("kennzahlen.reisetage_gesamt.subtitle", {
          anreise: data.reisetageNachTyp.reise_anreise,
          voll: data.reisetageNachTyp.reise_voll,
          abreise: data.reisetageNachTyp.reise_abreise,
          eintaegig: data.reisetageNachTyp.reise_eintaegig,
        })}
      />
    </div>
  );
}
