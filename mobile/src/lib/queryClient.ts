import { QueryClient } from '@tanstack/react-query';

/** One shared cache, so switching company (Super Admin) or signing out can drop every fetched list. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
