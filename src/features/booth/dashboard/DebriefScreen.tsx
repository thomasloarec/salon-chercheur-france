import { useMemo, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { BoothCache } from '../sync/cache';
import type { Interaction } from '@/lib/booth/types';
import { primaryLabel, salonDay, shortDate } from '../salon/display';
import { ACTION, fullName } from '../salon/labels';
import { PROVISIONAL_COMPANY } from '../card/cardQueue';
import { computeMetrics, dueYmd, isMeeting, isOpenAction, ownerId } from './metrics';
import DayChips, { dayChipLabel, salonToday, useSalonDays } from './DayChips';
import { memberName } from './DashboardScreen';

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function DebriefScreen({
  cache,
  me,
  onBack,
  onOpen,
}: {
  cache: BoothCache;
  me: string;
  onBack: () => void;
  onOpen: (interactionId: string) => void;
}) {
  const today = salonToday(cache);
  const [day, setDay] = useState(today);
  const days = useSalonDays(cache, true);
  const isManager = cache.role === 'manager';
  const tz = cache.workspace.timezone || 'Europe/Paris';
  const scope = isManager ? ('team' as const) : ('mine' as const);
  const contacts = useMemo(() => new Map(cache.contacts.map((c) => [c.id, c])), [cache.contacts]);

  const data = useMemo(() => {
    const m = computeMetrics(cache, { day, scope, me, today });
    const ids = new Set(m.ids.all);
    const projectIds = new Set(m.ids.withProject);
    const meetings = cache.interactions.filter((i) => ids.has(i.id));
    const priority = meetings
      .filter((i) => i.potential === 'hot' || projectIds.has(i.id))
      .sort((a, b) => Number(b.potential === 'hot') - Number(a.potential === 'hot') || b.occurred_at.localeCompare(a.occurred_at));

    const tomorrow = addDays(today, 1);
    const actions = cache.interactions
      .filter((i) => isMeeting(i, cache.workspaceId) && isOpenAction(i) && i.next_action_due)
      .filter((i) => scope === 'team' || ownerId(i, me) === me || i.next_action_owner_id === me)
      .filter((i) => {
        const d = dueYmd(i.next_action_due as string, tz);
        return d < today || d === tomorrow;
      });
    const byResp = new Map<string, Interaction[]>();
    for (const i of actions) {
      const r = i.next_action_owner_id ?? ownerId(i, me);
      if (!byResp.has(r)) byResp.set(r, []);
      byResp.get(r)!.push(i);
    }
    const toComplete = meetings.filter((i) => {
      const c = contacts.get(i.contact_id);
      return !c || (!c.email && !c.phone) || c.company_name === PROVISIONAL_COMPANY;
    });
    return { m, priority, byResp: [...byResp.entries()], toComplete };
  }, [cache, day, scope, me, today, tz, contacts]);

  const dayName = (() => {
    const d = salonDay(`${day}T12:00:00Z`, cache.workspace);
    return dayChipLabel(d) || shortDate(day);
  })();

  const who = (i: Interaction) => {
    const c = contacts.get(i.contact_id);
    return [c?.company_name?.trim(), fullName(c)].filter(Boolean).join(' · ') || primaryLabel(c ?? null);
  };
  const actionText = (i: Interaction) =>
    i.next_action === 'none' ? 'Aucune action prévue' : [ACTION[i.next_action], i.next_action_due ? `avant le ${shortDate(dueYmd(i.next_action_due, tz))}` : ''].filter(Boolean).join(' ');
  const resp = (i: Interaction) => memberName(cache, i.next_action_owner_id ?? ownerId(i, me));

  const { m } = data;
  const summary = `${dayName} : ${m.meetings} rencontre${m.meetings > 1 ? 's' : ''}, ${m.hot} prospect${m.hot > 1 ? 's' : ''} chaud${m.hot > 1 ? 's' : ''}, ${m.projects} projet${m.projects > 1 ? 's' : ''} concret${m.projects > 1 ? 's' : ''}`;

  const share = async () => {
    // Texte partagé : entreprise et prénom nom seulement, jamais d'email, de téléphone ni de note.
    const lines = [`Débrief ${cache.workspace.nom_event}`, summary, ''];
    if (data.priority.length) {
      lines.push('À rappeler en priorité :');
      for (const i of data.priority) lines.push(`- ${who(i)} : ${actionText(i)} (${resp(i)})`);
      lines.push('');
    }
    if (data.byResp.length) {
      lines.push('Actions de demain et en retard :');
      for (const [u, list] of data.byResp) {
        lines.push(`${memberName(cache, u)} :`);
        for (const i of list) lines.push(`- ${who(i)} : ${actionText(i)}`);
      }
    }
    const text = lines.join('\n').trim();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Débrief copié' });
    } catch {
      toast({ title: 'Impossible de copier le débrief', variant: 'destructive' });
    }
  };

  const Row = ({ i, children }: { i: Interaction; children?: React.ReactNode }) => (
    <li>
      <button type="button" onClick={() => onOpen(i.id)} className="min-h-[44px] w-full rounded-lg border border-border p-3 text-left active:bg-muted md:flex md:items-center md:justify-between md:gap-4">
        <p className="font-medium">{who(i)}</p>
        {children}
      </button>
    </li>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Tableau de bord
        </Button>
        <h2 className="text-lg font-semibold">Débrief du jour</h2>
      </div>
      <div className="space-y-5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DayChips days={days} value={day} onChange={setDay} allowAll={false} />
        <p className="text-lg font-semibold">{summary}</p>

        <section>
          <h3 className="mb-2 font-semibold">À rappeler en priorité</h3>
          {data.priority.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune rencontre chaude ni projet concret ce jour-là.</p>
          ) : (
            <ul className="space-y-2">
              {data.priority.map((i) => (
                <Row key={i.id} i={i}>
                  <p className="text-sm text-muted-foreground">{actionText(i)} · {resp(i)}</p>
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-semibold">Actions de demain et en retard</h3>
          {data.byResp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rien de prévu pour demain, aucun retard.</p>
          ) : (
            <div className="space-y-3">
              {data.byResp.map(([u, list]) => (
                <div key={u}>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">{memberName(cache, u)}</p>
                  <ul className="space-y-2">
                    {list.map((i) => {
                      const late = dueYmd(i.next_action_due as string, tz) < today;
                      return (
                        <Row key={i.id} i={i}>
                          <p className={`text-sm ${late ? 'font-medium text-warning-foreground' : 'text-muted-foreground'}`}>
                            {actionText(i)}{late ? ' · en retard' : ''}
                          </p>
                        </Row>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-semibold">Fiches à compléter</h3>
          {data.toComplete.length === 0 ? (
            <p className="text-sm text-muted-foreground">Toutes les fiches du jour ont des coordonnées.</p>
          ) : (
            <ul className="space-y-2">
              {data.toComplete.map((i) => (
                <Row key={i.id} i={i}>
                  <p className="text-sm text-muted-foreground">
                    {contacts.get(i.contact_id)?.company_name === PROVISIONAL_COMPANY ? 'Carte à traiter' : 'Ni email ni téléphone'}
                  </p>
                </Row>
              ))}
            </ul>
          )}
        </section>

        {isManager && (
          <section>
            <h3 className="mb-2 font-semibold">Par membre</h3>
            {m.byMember.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune rencontre.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {m.byMember.map((r) => (
                  <li key={r.userId} className="flex justify-between px-3 py-2 text-sm">
                    <span>{memberName(cache, r.userId)}</span>
                    <span className="tabular-nums text-muted-foreground">{r.meetings} rencontre{r.meetings > 1 ? 's' : ''} · {r.hot} chaud{r.hot > 1 ? 's' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <Button size="lg" className="min-h-[56px] w-full text-base md:w-auto md:min-w-[200px] md:min-h-[48px]" onClick={() => void share()}>
          <Share2 className="mr-2 h-5 w-5" /> Partager le débrief
        </Button>
      </div>
    </div>
  );
}
