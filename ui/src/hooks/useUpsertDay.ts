import { ApiError, type DayEntryDto, type UpsertDayBody, api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useUpsertDay(year: number) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ date, body }: { date: string; body: UpsertDayBody }) =>
      api.upsertDay(date, body),
    onMutate: async ({ date, body }) => {
      await queryClient.cancelQueries({ queryKey: ["days", year] });
      const previous = queryClient.getQueryData<DayEntryDto[]>(["days", year]);
      const optimistic: DayEntryDto = {
        date,
        year,
        type: body.type,
        homeoffice: body.homeoffice ?? false,
        tripId: body.tripId ?? null,
        fruehstueck: body.meals?.fruehstueck ?? false,
        mittag: body.meals?.mittag ?? false,
        abend: body.meals?.abend ?? false,
        zuzahlungCent: body.zuzahlungCent ?? 0,
      };
      queryClient.setQueryData<DayEntryDto[]>(["days", year], (old) => {
        if (!old) return [optimistic];
        const i = old.findIndex((d) => d.date === date);
        if (i >= 0) {
          const copy = [...old];
          copy[i] = { ...copy[i], ...optimistic };
          return copy;
        }
        return [...old, optimistic];
      });
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
