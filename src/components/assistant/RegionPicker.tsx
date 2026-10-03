import { useQuery } from '@tanstack/react-query';
import { Check, Globe2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Region {
  code: string;
  name: string;
  upcoming_events: number;
}

interface Props {
  value: string[];
  onChange: (codes: string[]) => void;
}

export default function RegionPicker({ value, onChange }: Props) {
  const { data: regions, isLoading } = useQuery({
    queryKey: ['assistant-regions'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Region[]> => {
      const { data, error } = await (supabase as any).rpc('assistant_regions_list');
      if (error) throw error;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return (parsed ?? []) as Region[];
    },
  });

  const everywhere = value.length === 0;
  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-pressed={everywhere}
        onClick={() => onChange([])}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          everywhere ? 'border-primary bg-violet-soft' : 'border-border bg-card hover:border-primary',
        )}
      >
        <Globe2 className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        <span className="flex-1 text-base font-semibold text-foreground">Partout en France</span>
        {everywhere && <Check className="h-5 w-5 text-primary" aria-hidden />}
      </button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))
          : (regions ?? []).map((r) => {
              const on = value.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(r.code)}
                  className={cn(
                    'relative flex min-h-16 min-w-0 flex-col justify-center rounded-lg border px-3 py-2 pr-7 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary',
                  )}
                >
                  <span className="break-words text-[15px] font-semibold leading-tight">{r.name}</span>
                  <span className={cn('mt-0.5 text-[13px]', on ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                    {r.upcoming_events === 0
                      ? 'Aucun salon à venir'
                      : `${r.upcoming_events} salon${r.upcoming_events > 1 ? 's' : ''} à venir`}
                  </span>
                  {on && <Check className="absolute right-2 top-2 h-4 w-4" aria-hidden />}
                </button>
              );
            })}
      </div>
    </div>
  );
}
