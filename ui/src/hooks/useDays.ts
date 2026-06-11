import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useDays(year: number) {
  return useQuery({
    queryKey: ["days", year],
    queryFn: () => api.listDays(year),
  });
}
