import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Interaction } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';
import { enqueue } from '../sync/engine';
import { shortDate, ymdInTz } from '../salon/display';
import { fullName } from '../salon/labels';
import { dueYmd, isMeeting, ownerId, todayInTz } from './metrics';
import { memberName } from './DashboardScreen';

const ACTION_LABEL: Record<Interaction['next_action'], string> = {
  call: 'Appeler',
  send_doc: 'Envoyer une documentation',
  quote: 'Faire un devis',
  meeting: 'Prendre rendez-vous',
  email: 'Envoyer un email',
  other: 'Autre',
  none: 'Aucune',
};

export const responsibleOf = (i: Interaction, me: string) => i.next_action_owner_id ?? ownerId(i, me);

/** Actions ouvertes visibles par l'utilisateur (toutes pour un manager). */
export function openActions(cache: BoothCache, me: string) {
  const isManager = cache.role === 'manager';
  return cache.interactions.filter(
    (i) =>
      isMeeting(i, cache.workspaceId) &&
      i.next_action !== 'none' &&
      !i.next_action_done_at &&
      (isManager || responsibleOf(i, me) === me),
  );
}

export default function ActionsScreen({
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
  const isManager = cache.role === 'manager';
  const tz = cache.workspace.timezone || 'Europe/Paris';
  const today = todayInTz(tz);
  const [member, setMember] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [reassignOne, setReassignOne] = useState<Interaction | null>(null);
  const [groupFrom, setGroupFrom] = useState<string | null>(null);
  const [groupTo, setGroupTo] = useState<string | null>(null);
  const contacts = useMemo(() => new Map(cache.contacts.map((c) => [c.id, c])), [cache.contacts]);

  const open = useMemo(() => {
    const due = (i: Interaction) => (i.next_action_due ? dueYmd(i.next_action_due, tz) : '9999-99-99');
    return openActions(cache, me)
      .filter((i) => !member || responsibleOf(i, me) === member)
      .sort((a, b) => {
        const la = due(a) < today ? 0 : 1;
        const lb = due(b) < today ? 0 : 1;
        return la - lb || due(a).localeCompare(due(b));
      });
  }, [cache, me, member, tz, today]);

  const doneToday = useMemo(
    () =>
      cache.interactions.filter(
        (i) =>
          isMeeting(i, cache.workspaceId) &&
          i.next_action !== 'none' &&
          !!i.next_action_done_at &&
          ymdInTz(i.next_action_done_at, tz) === today &&
          (isManager || responsibleOf(i, me) === me) &&
          (!member || responsibleOf(i, me) === member),
      ),
    [cache, me, isManager, member, tz, today],
  );

  const groups = useMemo(() => {
    const g = new Map<string, Interaction[]>();
    for (const i of open) {
      const r = responsibleOf(i, me);
      if (!g.has(r)) g.set(r, []);
      g.get(r)!.push(i);
    }
    return [...g.entries()];
  }, [open, me]);

  const who = (i: Interaction) => {
    const c = contacts.get(i.contact_id);
    return [c?.company_name?.trim(), fullName(c)].filter(Boolean).join(' · ') || 'Contact sans nom';
  };
  const update = (id: string, data: Record<string, unknown>) => enqueue(me, cache.exhibitorId, 'interaction', id, data);
  const canDone = (i: Interaction) => isManager || responsibleOf(i, me) === me || i.created_by === me;
  const label = (u: string) => (u === me ? 'Moi' : memberName(cache, u));

  const Line = ({ i }: { i: Interaction }) => {
    const d = i.next_action_due ? dueYmd(i.next_action_due, tz) : null;
    const late = !!d && d < today;
    return (
      <li className="rounded-lg border border-border p-3 md:flex md:items-center md:gap-4">
        <button type="button" className="min-h-[44px] w-full text-left md:grid md:min-w-0 md:flex-1 md:grid-cols-3 md:items-center md:gap-4" onClick={() => onOpen(i.id)}>
          <p className="font-medium">{ACTION_LABEL[i.next_action]}</p>
          <p className="text-sm">{who(i)}</p>
          <p className="text-xs text-muted-foreground">
            <span className={late ? 'font-medium text-destructive' : ''}>{d ? `Échéance ${shortDate(d)}${late ? ' · en retard' : ''}` : 'Sans échéance'}</span>
            {' · '}
            {label(responsibleOf(i, me))}
          </p>
        </button>
        <div className="mt-2 flex gap-2 md:mt-0 md:shrink-0">
          {canDone(i) && (
            <Button className="min-h-[44px] flex-1 md:flex-none md:min-w-[120px]" onClick={() => void update(i.id, { next_action_done: true })}>
              Fait
            </Button>
          )}
          {isManager && cache.team.length > 1 && (
            <Button variant="outline" className="min-h-[44px] flex-1 md:flex-none md:min-w-[120px]" onClick={() => setReassignOne(i)}>
              Réattribuer
            </Button>
          )}
        </div>
      </li>
    );
  };

  const groupCount = groupFrom ? groups.find(([u]) => u === groupFrom)?.[1].length ?? 0 : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Retour
        </Button>
        <h2 className="text-lg font-semibold">Actions à faire</h2>
      </div>
      <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {isManager && cache.team.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant={member === null ? 'default' : 'outline'} className="min-h-[44px] shrink-0 rounded-full" onClick={() => setMember(null)}>
              Toute l'équipe
            </Button>
            {cache.team.map((m) => (
              <Button
                key={m.user_id}
                size="sm"
                variant={member === m.user_id ? 'default' : 'outline'}
                className="min-h-[44px] shrink-0 rounded-full"
                onClick={() => setMember(m.user_id)}
              >
                {label(m.user_id)}
              </Button>
            ))}
          </div>
        )}

        {open.length === 0 && <p className="text-sm text-muted-foreground">Aucune action à faire.</p>}

        {isManager
          ? groups.map(([u, list]) => (
              <section key={u} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {label(u)} ({list.length})
                  </h3>
                  {cache.team.length > 1 && (
                    <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => { setGroupFrom(u); setGroupTo(null); }}>
                      Tout réattribuer à…
                    </Button>
                  )}
                </div>
                <ul className="space-y-2">
                  {list.map((i) => (
                    <Line key={i.id} i={i} />
                  ))}
                </ul>
              </section>
            ))
          : (
            <ul className="space-y-2">
              {open.map((i) => (
                <Line key={i.id} i={i} />
              ))}
            </ul>
          )}

        {doneToday.length > 0 && (
          <section>
            <Button variant="ghost" className="min-h-[44px] w-full justify-between" onClick={() => setShowDone((v) => !v)}>
              Faites aujourd'hui ({doneToday.length})
              <ChevronDown className={`h-4 w-4 transition-transform ${showDone ? 'rotate-180' : ''}`} />
            </Button>
            {showDone && (
              <ul className="mt-2 space-y-2">
                {doneToday.map((i) => (
                  <li key={i.id}>
                    <button type="button" className="min-h-[44px] w-full rounded-lg border border-border p-3 text-left text-muted-foreground" onClick={() => onOpen(i.id)}>
                      <p className="line-through">{ACTION_LABEL[i.next_action]}</p>
                      <p className="text-sm">{who(i)} · {label(responsibleOf(i, me))}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Réattribuer une action */}
      <AlertDialog open={!!reassignOne} onOpenChange={(o) => !o && setReassignOne(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réattribuer à</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            {cache.team.map((m) => (
              <Button
                key={m.user_id}
                variant={reassignOne && responsibleOf(reassignOne, me) === m.user_id ? 'default' : 'outline'}
                className="min-h-[48px]"
                onClick={() => {
                  if (reassignOne) void update(reassignOne.id, { next_action_owner_id: m.user_id });
                  setReassignOne(null);
                }}
              >
                {label(m.user_id)}
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tout réattribuer */}
      <AlertDialog open={!!groupFrom} onOpenChange={(o) => { if (!o) { setGroupFrom(null); setGroupTo(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {groupFrom && groupTo
                ? `Réattribuer ${groupCount} action${groupCount > 1 ? 's' : ''} de ${label(groupFrom)} à ${label(groupTo)} ?`
                : 'Tout réattribuer à'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {!groupTo && (
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              {cache.team.filter((m) => m.user_id !== groupFrom).map((m) => (
                <Button key={m.user_id} variant="outline" className="min-h-[48px]" onClick={() => setGroupTo(m.user_id)}>
                  {label(m.user_id)}
                </Button>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            {groupTo && (
              <AlertDialogAction
                onClick={async () => {
                  const list = groups.find(([u]) => u === groupFrom)?.[1] ?? [];
                  for (const i of list) await update(i.id, { next_action_owner_id: groupTo });
                  setGroupFrom(null);
                  setGroupTo(null);
                }}
              >
                Réattribuer
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
