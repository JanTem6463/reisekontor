import { ApiError, type TripWithDays, api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useDeleteTrip(year: number) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: number) => api.deleteTrip(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["trips", year] });
      const previous = queryClient.getQueryData<TripWithDays[]>(["trips", year]);
      queryClient.setQueryData<TripWithDays[]>(["trips", year], (old) =>
        old ? old.filter((t) => t.trip.id !== id) : [],
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["trips", year], ctx.previous);
      }
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
