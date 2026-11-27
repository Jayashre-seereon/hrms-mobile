import { QueryClient } from '@tanstack/react-query';
/** One shared cache, so switching company (Super Admin) or signing out can drop every fetched list. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry network blips once; a 4xx (403 no profile, 404…) will not change on retry.
      retry: (count, error) => count < 1 && !(error?.response?.status >= 400 && error?.response?.status < 500),
      staleTime: 30_000,
    },
  },
});
