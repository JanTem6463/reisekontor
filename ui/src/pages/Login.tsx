import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnauthorizedError, api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Wenn schon eingeloggt → direkt weiter
  useEffect(() => {
    api
      .getHealth()
      .then(() => navigate("/uebersicht", { replace: true }))
      .catch(() => {});
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.login(password);
      navigate("/uebersicht", { replace: true });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        toast.error(t("errors.invalid_password"));
      } else {
        toast.error(t("errors.network"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("pages.login.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("pages.login.password_placeholder")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {t("pages.login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
