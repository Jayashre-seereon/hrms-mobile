import { useQuery } from '@tanstack/react-query';
import { listCompanies } from '@/api/admin/masters-extra';
import { useSession } from '@/store/session';
/** Companies the user can manage branches for: Super Admin → all; Company Admin → own company (fallback from /me). */
export function useBranchCompanies() {
  const me = useSession((s) => s.me);
  return useQuery({
    queryKey: ['admin', 'masters', 'companies'],
    queryFn: async () => {
      try {
        return await listCompanies();
      } catch {
        const co = me?.company;
        return co?.id ? [{ id: String(co.id), name: co.name ?? '', code: co.code ?? '' }] : [];
      }
    },
  });
}
