import { ApiError, type TripBody, api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useUpdateTrip(year: number) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TripBody }) => api.updateTrip(id, body),
    onError: (err) => {
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        toast.error(t(key, { defaultValue: t("errors.unknown") }));
      } else {
        toast.error(t("errors.network"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["trips", year] });
      void queryClient.invalidateQueries({ queryKey: ["days", year] });
      void queryClient.invalidateQueries({ queryKey: ["summary", year] });
      void queryClient.invalidateQueries({ queryKey: ["checks", year] });
    },
  });
}
