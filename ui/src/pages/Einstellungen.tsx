import { PauschalenAnzeige } from "@/components/einstellungen/PauschalenAnzeige";
import { SettingsForm } from "@/components/einstellungen/SettingsForm";

export default function Einstellungen() {
  return (
    <div className="space-y-6">
      <SettingsForm />
      <PauschalenAnzeige />
    </div>
  );
}
