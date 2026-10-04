import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Globe2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { FRANCE_MAP_VIEWBOX, FRANCE_REGION_SHAPES } from './franceRegions';

interface Region {
  code: string;
  name: string;
  upcoming_events: number;
}

interface Props {
  value: string[];
  onChange: (codes: string[]) => void;
}

const countLabel = (n: number | undefined) =>
  n === undefined ? '' : n === 0 ? 'Aucun salon à venir' : `${n} salon${n > 1 ? 's' : ''} à venir`;

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
  const [focused, setFocused] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const everywhere = value.length === 0;
  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  const byCode = new Map((regions ?? []).map((r) => [r.code, r]));
  const nameOf = (code: string) =>
    byCode.get(code)?.name ?? FRANCE_REGION_SHAPES.find((s) => s.code === code)?.name ?? code;
  const shapeCodes = new Set(FRANCE_REGION_SHAPES.map((s) => s.code));
  const overseas = (regions ?? []).filter((r) => !shapeCodes.has(r.code));

  const info = focused
    ? (() => {
        const n = byCode.get(focused)?.upcoming_events;
        return `${nameOf(focused)}${n === undefined ? '' : ` · ${countLabel(n)}`}`;
      })()
    : 'Touchez les régions où vous êtes prêt à aller.';

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
        <span className="flex-1 text-base font-medium text-foreground">Partout en France</span>
        {everywhere && <Check className="h-5 w-5 text-primary" aria-hidden />}
      </button>

      <div className="rounded-xl bg-card p-3">
        <svg
          viewBox={FRANCE_MAP_VIEWBOX}
          className="mx-auto block h-auto w-full max-w-[520px]"
          role="group"
          aria-label="Carte des régions de France"
        >
          {FRANCE_REGION_SHAPES.map((s) => {
            const on = value.includes(s.code);
            const label = `${s.name}, ${countLabel(byCode.get(s.code)?.upcoming_events) || 'salons à venir'}`;
            return (
              <path
                key={s.code}
                d={s.d}
                role="checkbox"
                aria-checked={on}
                aria-label={label}
                tabIndex={0}
                onClick={() => {
                  toggle(s.code);
                  setFocused(s.code);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(s.code);
                  }
                }}
                onFocus={() => setFocused(s.code)}
                onMouseEnter={() => {
                  setHovered(s.code);
                  setFocused(s.code);
                }}
                onMouseLeave={() => setHovered(null)}
                strokeWidth={1.5}
                strokeLinejoin="round"
                className={cn(
                  'cursor-pointer stroke-background outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:stroke-foreground focus-visible:[stroke-width:2.5]',
                  on ? 'fill-primary' : hovered === s.code ? 'fill-primary/35' : 'fill-violet-soft',
                )}
              >
                <title>{label}</title>
              </path>
            );
          })}
        </svg>
        <p aria-live="polite" className="mt-2 text-center text-[15px] text-muted-foreground">
          {info}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {overseas.map((r) => {
          const on = value.includes(r.code);
          return (
            <button
              key={r.code}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(r.code)}
              className={cn(
                'inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'bg-primary text-primary-foreground' : 'bg-background text-primary hover:bg-violet-soft',
              )}
            >
              {on && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="break-words">
                {r.name} · {r.upcoming_events} salon{r.upcoming_events > 1 ? 's' : ''}
              </span>
            </button>
          );
        })}
        {value
          .filter((c) => shapeCodes.has(c))
          .map((c) => (
            <span
              key={c}
              className="inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full bg-primary py-1 pl-4 pr-1 text-sm font-medium text-primary-foreground"
            >
              <span className="break-words">{nameOf(c)}</span>
              <button
                type="button"
                aria-label={`Retirer ${nameOf(c)}`}
                onClick={() => toggle(c)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </span>
          ))}
      </div>

      <button
        type="button"
        aria-expanded={showList}
        onClick={() => setShowList((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Choisir dans une liste
        <ChevronDown className={cn('h-4 w-4 transition-transform', showList && 'rotate-180')} aria-hidden />
      </button>

      {showList && (
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
                    <span className="break-words text-[15px] font-medium leading-tight">{r.name}</span>
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
      )}
    </div>
  );
}
