import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useTrips(year: number) {
  return useQuery({
    queryKey: ["trips", year],
    queryFn: () => api.listTrips(year),
  });
}
