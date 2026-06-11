import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useChecks(year: number) {
  return useQuery({
    queryKey: ["checks", year],
    queryFn: () => api.getChecks(year),
  });
}
