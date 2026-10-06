import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { myContext, type BoothContextItem } from '@/lib/booth/rpc';

/** Entreprises Lotexpo Leads de l'utilisateur connecté. Ne lève jamais d'erreur : liste vide en cas d'échec. */
export function useBoothContext() {
  const { isRealUser, user } = useAuth();
  return useQuery<BoothContextItem[]>({
    queryKey: ['booth-my-context', user?.id ?? null],
    queryFn: async () => {
      try {
        const r = await myContext();
        return r?.items ?? [];
      } catch {
        return [];
      }
    },
    enabled: isRealUser,
    staleTime: 60_000,
  });
}
