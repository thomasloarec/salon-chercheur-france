import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  boothErrorMessage,
  getBillingOverview,
  listWorkspaces,
  startCheckout,
  type BoothBillingOverview,
  type BoothCheckoutPlan,
  type BoothWorkspace,
} from '@/lib/booth/rpc';
import { formatCents, openCheckoutUrl, runCheckout, vatMention } from './billing';

export interface PlanPickerEvent {
  id: string;
  name: string;
  date_debut?: string | null;
}

/** Union participations à venir + salons des espaces non archivés à venir, sans doublon, triée par date de début. */
export function mergePlanEvents(
  participations: PlanPickerEvent[],
  workspaces: Pick<BoothWorkspace, 'event_id' | 'nom_event' | 'date_debut' | 'date_fin' | 'archived'>[],
  today: string,
): { events: PlanPickerEvent[]; preselect: string | null } {
  const map = new Map<string, PlanPickerEvent>();
  for (const p of participations) if (!map.has(p.id)) map.set(p.id, p);
  const wsEvents: PlanPickerEvent[] = [];
  for (const w of workspaces) {
    if (w.archived) continue;
    const ref = w.date_fin || w.date_debut;
    if (!ref || ref.slice(0, 10) < today) continue;
    const ev = { id: w.event_id, name: w.nom_event, date_debut: w.date_debut };
    wsEvents.push(ev);
    if (!map.has(ev.id)) map.set(ev.id, ev);
    else if (!map.get(ev.id)!.date_debut) map.set(ev.id, { ...map.get(ev.id)!, date_debut: w.date_debut });
  }
  const byDate = (a: PlanPickerEvent, b: PlanPickerEvent) => (a.date_debut ?? '').localeCompare(b.date_debut ?? '');
  const events = [...map.values()].sort(byDate);
  const preselect = wsEvents.length ? [...wsEvents].sort(byDate)[0].id : events.length === 1 ? events[0].id : null;
  return { events, preselect };
}

/** Ajoute un salon trouvé par la recherche (sans doublon) et le sélectionne. */
export function addSearchedEvent(list: PlanPickerEvent[], ev: PlanPickerEvent) {
  const events = list.some((e) => e.id === ev.id) ? list : [...list, ev].sort((a, b) => (a.date_debut ?? '').localeCompare(b.date_debut ?? ''));
  return { events, selected: ev.id };
}

type SearchFn = (q: string) => Promise<PlanPickerEvent[]>;

const defaultSearch: SearchFn = async (q) => {
  const { data, error } = await supabase.rpc('search_upcoming_events', { p_query: q, p_limit: 10 });
  if (error) throw error;
  return ((data ?? []) as { id: string; nom_event: string; date_debut: string | null }[]).map((e) => ({
    id: e.id, name: e.nom_event, date_debut: e.date_debut,
  }));
};

function EventSearch({ search, onPick }: { search: SearchFn; onPick: (e: PlanPickerEvent) => void }) {
  const [q, setQ] = useState('');
  const d = useDebounce(q, 300);
  const [res, setRes] = useState<PlanPickerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = d.trim();
    if (t.length < 2) { setRes([]); return; }
    let live = true;
    setLoading(true);
    search(t).then((r) => live && setRes(r)).catch(() => live && setRes([])).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [d, search]);
  return (
    <div className="space-y-2">
      <Input autoFocus placeholder="Rechercher un salon à venir" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un salon" />
      {q.trim().length < 2 ? (
        <p className="text-xs text-muted-foreground">2 lettres minimum</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Recherche…</p>
      ) : res.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun salon trouvé</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {res.map((e) => (
            <li key={e.id}>
              <button type="button" className="min-h-[44px] w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onPick(e)}>
                {e.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ViewProps {
  overview: BoothBillingOverview;
  upcoming: PlanPickerEvent[];
  /** 'both' par défaut ; 'annual' pour la prolongation seule. */
  show?: 'both' | 'annual';
  annualActive?: boolean;
  initialEventId?: string | null;
  initialError?: string | null;
  onPay?: (plan: BoothCheckoutPlan, eventId: string | null) => Promise<void>;
  search?: SearchFn;
}

const card = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:p-5';

export function BoothPlanPickerView({
  overview,
  upcoming,
  show = 'both',
  annualActive = false,
  initialEventId = null,
  initialError = null,
  onPay,
  search = defaultSearch,
}: ViewProps) {
  const [eventId, setEventId] = useState<string | null>(initialEventId);
  const [extra, setExtra] = useState<PlanPickerEvent[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!eventId && initialEventId) setEventId(initialEventId);
  }, [initialEventId, eventId]);
  const list = extra.reduce((acc, e) => addSearchedEvent(acc, e).events, upcoming);
  const [busy, setBusy] = useState<BoothCheckoutPlan | null>(null);
  const [error, setError] = useState<{ plan: BoothCheckoutPlan | 'any'; msg: string } | null>(
    initialError ? { plan: 'any', msg: boothErrorMessage(initialError) } : null,
  );
  const pass = formatCents(overview.pass_amount_cents, overview.currency);
  const annual = formatCents(overview.annual_amount_cents, overview.currency);

  const pay = async (plan: BoothCheckoutPlan) => {
    if (!onPay || busy) return;
    setBusy(plan);
    setError(null);
    try {
      await onPay(plan, plan === 'pass' ? eventId : null);
    } catch (e) {
      setError({ plan, msg: boothErrorMessage(e) });
      setBusy(null);
    }
  };

  const errFor = (plan: BoothCheckoutPlan) =>
    error && (error.plan === plan || error.plan === 'any') ? (
      <p role="alert" className="text-sm text-destructive">{error.msg}</p>
    ) : null;

  return (
    <div className="space-y-3">
      {!overview.livemode && (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Mode test : utilisez la carte 4242 4242 4242 4242, date future, code 123.
        </p>
      )}
      <div className={`grid grid-cols-1 gap-3 ${show === 'both' ? 'md:grid-cols-2' : ''}`}>
        {show === 'both' && (
          <div className={card}>
            <div>
              <p className="font-semibold text-foreground">Pass salon</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{pass}</p>
              <p className="text-sm font-medium text-muted-foreground">par salon, jusqu'à 15 utilisateurs</p>
            </div>
            <p className="text-sm text-muted-foreground">Choisissez le salon couvert par ce Pass</p>
            {list.length > 0 && (
              <Select value={eventId ?? undefined} onValueChange={setEventId}>
                <SelectTrigger aria-label="Salon">
                  <SelectValue placeholder="Choisissez le salon" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {searching ? (
              <EventSearch
                search={search}
                onPick={(e) => {
                  setExtra((x) => (x.some((y) => y.id === e.id) ? x : [...x, e]));
                  setEventId(e.id);
                  setSearching(false);
                }}
              />
            ) : (
              <button type="button" className="min-h-[44px] self-start text-left text-sm font-medium text-primary underline" onClick={() => setSearching(true)}>
                Mon salon n'est pas dans la liste
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Valable jusqu'à {overview.pass_grace_days} jours après la fin du salon, pour vos relances et votre export.
            </p>
            <Button
              className="mt-auto h-auto min-h-[44px] w-full whitespace-normal rounded-xl"
              disabled={!eventId || !!busy || !onPay}
              onClick={() => pay('pass')}
              data-plan="pass"
            >
              {busy === 'pass' ? 'Ouverture du paiement…' : `Payer ${pass}`}
            </Button>
            {errFor('pass')}
          </div>
        )}
        <div className={card}>
          <div>
            <p className="font-semibold text-foreground">Annuel</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{annual}</p>
            <p className="text-sm font-medium text-muted-foreground">
              12 mois, tous vos salons, jusqu'à 15 utilisateurs, accompagnement au premier salon
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Le prix de 3 Pass salon, pour tous vos salons de l'année</p>
          </div>
          <Button
            className="mt-auto h-auto min-h-[44px] w-full whitespace-normal rounded-xl"
            variant={show === 'both' ? 'outline' : 'default'}
            disabled={!!busy || !onPay}
            onClick={() => pay('annual')}
            data-plan="annual"
          >
            {busy === 'annual'
              ? 'Ouverture du paiement…'
              : annualActive
                ? `Prolonger de 12 mois · ${annual}`
                : `Choisir l'Annuel · Payer ${annual}`}
          </Button>
          {errFor('annual')}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{vatMention(overview.vat_mode)}</p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Paiement sécurisé par Stripe. L'accès s'ouvre dès le paiement validé.
      </p>
    </div>
  );
}

interface Props {
  exhibitorId: string;
  upcoming: PlanPickerEvent[];
  show?: 'both' | 'annual';
  annualActive?: boolean;
}

export default function BoothPlanPicker({ exhibitorId, upcoming, show, annualActive }: Props) {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const ws = useQuery({
    queryKey: ['booth-workspaces', exhibitorId],
    queryFn: () => listWorkspaces(exhibitorId),
    retry: false,
  });
  const merged = mergePlanEvents(upcoming, ws.data?.items ?? [], new Date().toISOString().slice(0, 10));
  const q = useQuery({
    queryKey: ['booth-billing', exhibitorId],
    queryFn: () => getBillingOverview(exhibitorId),
    retry: false,
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  if (q.isError || !q.data) {
    const forbidden = String((q.error as Error)?.message ?? '').includes('BOOTH_FORBIDDEN');
    return (
      <p className="text-sm text-muted-foreground">
        {forbidden ? 'Seuls les administrateurs de la fiche peuvent choisir une formule.' : boothErrorMessage(q.error)}
      </p>
    );
  }

  return (
    <>
    <BoothPlanPickerView
      overview={q.data}
      upcoming={merged.events}
      initialEventId={merged.preselect}
      show={show}
      annualActive={annualActive}
      onPay={(plan, eventId) =>
        runCheckout((p, e) => startCheckout(exhibitorId, p, e), plan, eventId, (url) => {
          if (!openCheckoutUrl(url, window)) setFallbackUrl(url);
        })
      }
    />
    {fallbackUrl && (
      <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline">
        Ouvrir la page de paiement
      </a>
    )}
    </>
  );
}
