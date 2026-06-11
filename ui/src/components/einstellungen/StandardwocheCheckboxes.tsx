import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Standardwoche } from "@/lib/api";
import { useTranslation } from "react-i18next";

const DAYS: Array<keyof Standardwoche> = ["mo", "di", "mi", "do", "fr", "sa", "so"];

interface Props {
  value: Standardwoche;
  onChange: (next: Standardwoche) => void;
}

export function StandardwocheCheckboxes({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-7">
      {DAYS.map((day) => (
        <div key={day} className="flex items-center space-x-2">
          <Checkbox
            id={`sw-${day}`}
            checked={value[day]}
            onCheckedChange={(c) => onChange({ ...value, [day]: c === true })}
          />
          <Label htmlFor={`sw-${day}`}>{t(`weekdays.${day}`)}</Label>
        </div>
      ))}
    </div>
  );
}
