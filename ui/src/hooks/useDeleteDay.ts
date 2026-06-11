import { ApiError, type DayEntryDto, api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useDeleteDay(year: number) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (date: string) => api.deleteDay(date),
    onMutate: async (date) => {
      await queryClient.cancelQueries({ queryKey: ["days", year] });
      const previous = queryClient.getQueryData<DayEntryDto[]>(["days", year]);
      queryClient.setQueryData<DayEntryDto[]>(["days", year], (old) =>
        old ? old.filter((d) => d.date !== date) : [],
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["days", year], ctx.previous);
      }
      if (err instanceof ApiError) {
        const key = `errors.${err.code}`;
        const msg = t(key, { defaultValue: t("errors.unknown") });
        toast.error(msg);
      } else {
        toast.error(t("errors.network"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["days", year] });
      void queryClient.invalidateQueries({ queryKey: ["summary", year] });
      void queryClient.invalidateQueries({ queryKey: ["checks", year] });
    },
  });
}
