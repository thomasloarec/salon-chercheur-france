import { useVoiceItems } from '../voice/voiceQueue';
import Chip from '../ui/Chip';
import { Link } from 'react-router-dom';
import AppButton from '../ui/ChunkyButton';
import { EmptyState, SearchIllustration, StandIllustration } from '../ui/illustrations';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CloudUpload, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BoothInboundLead } from '@/lib/booth/rpc';
import { onBoothChange, type BoothCache } from '../sync/cache';
import { listOutbox } from '../sync/engine';
import { useCards, type CardState } from '../card/cardQueue';

const CARD_BADGE: Record<CardState, { label: string; cls: string }> = {
  pending: { label: 'Carte en attente', cls: 'bg-muted text-muted-foreground' },
  read: { label: 'Carte lue : à vérifier', cls: 'bg-warning-surface text-warning-foreground border border-warning' },
  unreadable: { label: 'Carte illisible : à compléter', cls: 'bg-destructive/10 text-destructive' },
  blocked: { label: 'Lecture non incluse', cls: 'bg-muted text-muted-foreground' },
};

import { dayTimeLabel, longDate, primaryLabel, salonDay, secondaryLabel } from './display';
import PotentialBadge from '../ui/PotentialBadge';
import { ACTION, fullName, initials, isCompleted, ownerOf } from './labels';

export default function MeetingsList({
  cache,
  me,
  onBack,
  onOpen,
  onInbound,
  cardFilter = null,
  onClearCardFilter,
  idFilter = null,
  onClearIdFilter,
  selectedId = null,
  onNew,
}: {
  onNew?: () => void;
  selectedId?: string | null;
  idFilter?: { ids: string[]; label: string } | null;
  onClearIdFilter?: () => void;
  cardFilter?: 'pending' | 'review' | null;
  onClearCardFilter?: () => void;
  cache: BoothCache;
  me: string;
  onBack: () => void;
  onOpen: (interactionId: string) => void;
  onInbound: (lead: BoothInboundLead) => void;
}) {
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [member, setMember] = useState<string | null>(null);
  const isManager = cache.role === 'manager';
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const read = async () => setPendingIds(new Set((await listOutbox(me, cache.exhibitorId)).map((i) => i.id)));
    void read();
    return onBoothChange(() => void read());
  }, [me, cache.exhibitorId]);

  const cards = useCards(me, cache.workspaceId);
  const voiceItems = useVoiceItems(me, cache.workspaceId);
  const voiceByInteraction = useMemo(() => new Map(voiceItems.map((v) => [v.interactionId, v.state])), [voiceItems]);
  const cardByContact = useMemo(() => new Map(cards.filter((c) => c.contactId).map((c) => [c.contactId!, c.state])), [cards]);

  const contacts = useMemo(() => new Map(cache.contacts.map((c) => [c.id, c])), [cache.contacts]);
  const inbound = useMemo(() => {
    const linked = new Set(cache.interactions.map((i) => i.inbound_lead_id).filter(Boolean));
    return (cache.inbound_leads ?? []).filter((l) => !linked.has(l.lead_id));
  }, [cache.inbound_leads, cache.interactions]);

  const idSet = useMemo(() => new Set(idFilter?.ids ?? []), [idFilter]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cache.interactions
      .filter((i) => i.workspace_id === cache.workspaceId || !i.workspace_id)
      .filter(isCompleted)
      .filter((i) => {
        if (!cardFilter) return true;
        const st = cardByContact.get(i.contact_id);
        return cardFilter === 'pending' ? st === 'pending' : st === 'read' || st === 'unreadable' || st === 'blocked';
      })
      .filter((i) => !idFilter || idSet.has(i.id))
      .filter((i) => !member || ownerOf(i, me) === member)
      .filter((i) => cardFilter || idFilter || member || tab === 'team' || ownerOf(i, me) === me || i.created_by === me)
      .filter((i) => {
        if (!q) return true;
        const c = contacts.get(i.contact_id);
        return [fullName(c), c?.company_name, c?.email].some((v) => (v ?? '').toLowerCase().includes(q));
      })
      .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));
  }, [cache.interactions, cache.workspaceId, tab, me, query, contacts, cardFilter, cardByContact, idFilter, idSet, member]);

  const ws = cache.workspace;
  const allDays = useMemo(() => {
    const m = new Map<string, ReturnType<typeof salonDay>>();
    for (const i of cache.interactions.filter((x) => (x.workspace_id === cache.workspaceId || !x.workspace_id) && isCompleted(x))) {
      const d = salonDay(i.occurred_at, ws);
      m.set(d.key, d);
    }
    return [...m.values()].sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''));
  }, [cache.interactions, cache.workspaceId, ws]);

  const groups = useMemo(() => {
    const g = new Map<string, { day: ReturnType<typeof salonDay>; items: typeof rows }>();
    for (const i of rows) {
      const d = salonDay(i.occurred_at, ws);
      if (day && d.key !== day) continue;
      if (!g.has(d.key)) g.set(d.key, { day: d, items: [] });
      g.get(d.key)!.items.push(i);
    }
    return [...g.values()].sort((a, b) => (b.day.key ?? '').localeCompare(a.day.key ?? ''));
  }, [rows, ws, day]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Accueil
        </Button>
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Rencontres du salon</h2>
      </div>
      <div className="space-y-3 px-4 pb-4">
        {inbound.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4" /> Rendez-vous demandés sur Lotexpo
            </p>
            <ul className="space-y-2">
              {inbound.map((l) => (
                <li key={l.lead_id}>
                  <button
                    type="button"
                    className="w-full rounded-md bg-background p-3 text-left hover:bg-muted"
                    onClick={() => onInbound(l)}
                  >
                    <p className="font-medium">
                      {l.name || l.email || 'Sans nom'}
                      {l.company ? <span className="font-normal text-muted-foreground"> · {l.company}</span> : null}
                    </p>
                    {(l.rdv_date || l.preferred_slot) && (
                      <p className="text-xs text-muted-foreground">
                        {[l.rdv_date && new Date(l.rdv_date).toLocaleDateString('fr-FR'), l.preferred_slot].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {idFilter && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-sm">
            <span>{idFilter.label}</span>
            <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={onClearIdFilter}>Tout afficher</Button>
          </div>
        )}
        {cardFilter && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-sm">
            <span>{cardFilter === 'pending' ? 'Cartes en attente de lecture' : 'Cartes à vérifier'}</span>
            <Button size="sm" variant="ghost" className="min-h-[40px]" onClick={onClearCardFilter}>Tout afficher</Button>
          </div>
        )}
        <div className="space-y-3 md:flex md:flex-wrap md:items-center md:gap-2 md:space-y-0">
        <div className="flex gap-2 md:shrink-0">
          {(['mine', 'team'] as const).map((t) => (
            <Chip key={t} selected={tab === t} onClick={() => { setTab(t); setMember(null); }}>
              {t === 'mine' ? 'Les miennes' : 'Équipe'}
            </Chip>
          ))}
        </div>

        {isManager && cache.team.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Par membre">
            {cache.team.map((m) => (
              <Chip key={m.user_id}
                selected={member === m.user_id} onClick={() => setMember(member === m.user_id ? null : m.user_id)}>
                {m.user_id === me ? 'Moi' : m.name || m.email || 'Membre'}
              </Chip>
            ))}
          </div>
        )}

        <div className="relative md:min-w-[200px] md:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nom, entreprise, email"
            className="h-12 pl-9 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {allDays.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip selected={day === null} onClick={() => setDay(null)}>
              Tous les jours
            </Chip>
            {allDays.map((d) => (
              <Chip key={d.key} selected={day === d.key} onClick={() => setDay(d.key)}>
                {d.short && !d.short.includes('salon') ? d.short : `${d.short} ${new Date(`${d.key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`.trim()}
              </Chip>
            ))}
          </div>
        )}
        </div>

        {groups.length === 0 ? (
          !cache.interactions.some((x) => x.workspace_id === cache.workspaceId && isCompleted(x)) ? (
            <EmptyState
              art={<StandIllustration />}
              title="Votre stand est prêt. Première rencontre ?"
              text="Scannez un badge, photographiez une carte ou dictez en 20 secondes. Tout fonctionne aussi sans réseau."
            >
              {onNew && !cache.workspace.archived && <AppButton onClick={onNew}>Nouvelle rencontre</AppButton>}
              {isManager && (
                <Link to="/leads" className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline underline-offset-2">
                  Inviter un collègue sur le stand
                </Link>
              )}
            </EmptyState>
          ) : (
            <EmptyState art={<SearchIllustration />} title="Aucun résultat" />
          )
        ) : (
          groups.map((g) => (
          <div key={g.day.key} className="space-y-2">
          <p className="text-sm font-semibold">
            {[g.day.short, longDate(g.day.key), `${g.items.length} rencontre${g.items.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {g.items.map((i) => {
              const c = contacts.get(i.contact_id);
              const pending = pendingIds.has(i.id) || pendingIds.has(i.contact_id);
              return (
                <li key={i.id}>
                  <button type="button" className={`flex w-full items-start gap-3 p-3 text-left hover:bg-muted ${selectedId === i.id ? 'lg:bg-primary/10' : ''}`} aria-current={selectedId === i.id ? 'true' : undefined} onClick={() => onOpen(i.id)}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initials(cache, ownerOf(i, me))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{primaryLabel(c)}</span>
                        {pending && <CloudUpload className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="En attente d'envoi" />}
                      </span>
                      {secondaryLabel(c) && <span className="block truncate text-sm text-muted-foreground">{secondaryLabel(c)}</span>}
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {cardByContact.get(i.contact_id) && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${CARD_BADGE[cardByContact.get(i.contact_id)!].cls}`}>
                            {CARD_BADGE[cardByContact.get(i.contact_id)!].label}
                          </span>
                        )}
                        {voiceByInteraction.get(i.id) && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${voiceByInteraction.get(i.id) === 'blocked' ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-secondary-foreground'}`}>
                            {voiceByInteraction.get(i.id) === 'blocked' ? 'Note vocale non transcrite' : 'Note vocale en attente'}
                          </span>
                        )}
                        {i.potential && (
                          <PotentialBadge value={i.potential} />
                        )}
                        {i.next_action && i.next_action !== 'none' && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${i.next_action_done_at ? 'bg-muted text-muted-foreground line-through' : 'bg-secondary text-secondary-foreground'}`}>
                            {ACTION[i.next_action]}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="max-w-[42%] shrink-0 text-right text-xs text-muted-foreground">{dayTimeLabel(i.occurred_at, ws)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
