import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useSummary(year: number) {
  return useQuery({
    queryKey: ["summary", year],
    queryFn: () => api.getSummary(year),
  });
}
