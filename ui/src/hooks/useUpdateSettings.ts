import { ApiError, type UpdateSettingsBody, api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (body: UpdateSettingsBody) => api.updateSettings(body),
    onError: (err) => {
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        toast.error(t(key, { defaultValue: t("errors.unknown") }));
      } else {
        toast.error(t("errors.network"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
