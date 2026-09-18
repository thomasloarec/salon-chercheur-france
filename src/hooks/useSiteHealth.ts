import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SiteHealthStatus = 'ok' | 'warn' | 'critical';

export interface SiteHealthCheck {
  check_key: string;
  category: string;
  label: string;
  status: SiteHealthStatus;
  metric: number;
  detail: string | null;
}

export const STATUS_ORDER: Record<SiteHealthStatus, number> = {
  critical: 0,
  warn: 1,
  ok: 2,
};

export const useSiteHealth = () =>
  useQuery({
    queryKey: ['site-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('compute_site_health');
      if (error) throw error;
      return (data ?? []) as SiteHealthCheck[];
    },
    staleTime: 30_000,
    retry: 1,
  });

export const summarizeHealth = (checks: SiteHealthCheck[] | undefined) => {
  const list = checks ?? [];
  const critical = list.filter((c) => c.status === 'critical').length;
  const warn = list.filter((c) => c.status === 'warn').length;
  if (critical > 0) return { level: 'critical' as const, critical, warn };
  if (warn > 0) return { level: 'warn' as const, critical, warn };
  return { level: 'ok' as const, critical, warn };
};

export const categoryLabel = (category: string) => {
  if (!category) return 'Divers';
  const cleaned = category.replace(/[_-]+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};
