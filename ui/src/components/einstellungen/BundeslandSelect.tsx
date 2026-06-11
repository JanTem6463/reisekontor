import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

const STATES = [
  "BB",
  "BE",
  "BW",
  "BY",
  "HB",
  "HE",
  "HH",
  "MV",
  "NI",
  "NW",
  "RP",
  "SH",
  "SL",
  "SN",
  "ST",
  "TH",
] as const;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function BundeslandSelect({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATES.map((code) => (
          <SelectItem key={code} value={code}>
            {t(`bundeslaender.${code}`)} ({code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
