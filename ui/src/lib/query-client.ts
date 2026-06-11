import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./api";

export function createQueryClient(onUnauthorized: () => void): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
