import { ApiError, api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useSyncHolidays() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (year: number) => api.syncHolidays(year),
    onError: (err) => {
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        toast.error(t(key, { defaultValue: t("errors.unknown") }));
      } else {
        toast.error(t("errors.network"));
      }
    },
    onSettled: (_data, _err, year) => {
      void queryClient.invalidateQueries({ queryKey: ["days", year] });
      void queryClient.invalidateQueries({ queryKey: ["summary", year] });
      void queryClient.invalidateQueries({ queryKey: ["checks", year] });
    },
  });
}
