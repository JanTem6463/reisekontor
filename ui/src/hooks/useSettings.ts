import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
}
