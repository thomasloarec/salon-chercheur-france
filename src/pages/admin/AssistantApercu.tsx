import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAssistantFeed } from '@/components/assistant/useAssistantFeed';
import { useAssistantActions } from '@/components/assistant/useAssistantActions';
import AssistantEventCard from '@/components/assistant/AssistantEventCard';
import AssistantItemCard from '@/components/assistant/AssistantItemCard';
import { dayLabel, timeLabel } from '@/components/assistant/format';
import type { AssistantItem } from '@/components/assistant/types';

export default function AssistantApercu() {
  const { data: feed, isLoading } = useAssistantFeed();
  const actions = useAssistantActions();
  const profileId = feed?.profile?.id;
  const agendaBlocks = feed?.agenda_pepites ?? [];
  const eventIds = agendaBlocks.map((b) => b.event_id);

  const { data: eventNames } = useQuery({
    queryKey: ['assistant-apercu-events', eventIds],
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id, nom_event').in('id', eventIds);
      return Object.fromEntries((data ?? []).map((e: any) => [e.id, e.nom_event])) as Record<string, string>;
    },
  });

  const suggestions = feed?.suggestions ?? [];

  return (
    <div className="min-h-screen bg-muted/40 py-8">
      <Helmet>
        <title>Aperçu de l'assistant (admin)</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto max-w-[1180px] space-y-8 px-4">
        <div>
          <h1 className="heading-display text-3xl">Aperçu de l'assistant (admin)</h1>
          {feed?.status && (
            <p className="mt-1 text-sm text-muted-foreground">
              {feed.status.refreshing
                ? 'Recherche en cours…'
                : feed.status.refreshed_at
                  ? `Mis à jour le ${format(parseISO(feed.status.refreshed_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`
                  : null}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : !feed?.has_profile ? (
          <p className="text-muted-foreground">Aucun assistant pour ce compte.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary p-4 text-primary-foreground">
              <Search className="h-5 w-5" aria-hidden />
              <span className="font-bold">Je cherche pour vous</span>
              {(feed.pistes ?? []).map((p) => (
                <span key={p.id} className="rounded-full bg-background px-3 py-1 text-sm font-medium text-primary">
                  {p.short_label}
                </span>
              ))}
            </div>

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="heading-display text-[30px]">À découvrir</h2>
                <span className="rounded-full bg-surface-inverse px-3 py-1 text-sm font-bold text-inverse">
                  {suggestions.length}
                </span>
              </div>
              {suggestions.length === 0 ? (
                <p className="text-muted-foreground">
                  Rien à ne pas manquer pour l'instant sur vos prochains salons. Je vous préviens dès que ça change.
                </p>
              ) : (
                suggestions.map((s) => (
                  <AssistantEventCard key={s.event.id} suggestion={s} profileId={profileId} />
                ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="heading-display text-[30px]">Mes salons (aperçu des blocs du lot 3c)</h2>
              {agendaBlocks.map((block) => {
                const kept = (feed.kept_sessions ?? []).filter((k) => k.event_id === block.event_id);
                const others = block.pepites.filter((p) => !p.kept);
                return (
                  <div key={block.event_id} className="space-y-4 rounded-[14px] bg-card p-4 shadow-sm sm:p-6">
                    <h3 className="text-xl font-bold">{eventNames?.[block.event_id] ?? '…'}</h3>
                    {kept.length > 0 && (
                      <div>
                        <h4 className="mb-2 font-semibold">Conférences retenues</h4>
                        <ul className="divide-y divide-border">
                          {kept.map((k) => (
                            <li key={k.feedback_id} className="flex items-center gap-4 py-3">
                              <div className="w-16 text-center">
                                <div className="text-[22px] font-bold">{timeLabel(k.start_time)}</div>
                                <div className="text-xs text-muted-foreground">{dayLabel(k.day_date)}</div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">{k.title}</p>
                                {k.location && <p className="text-sm text-muted-foreground">{k.location}</p>}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                className="min-h-11"
                                onClick={() =>
                                  actions.removeFromAgenda({ item_type: 'session', item_id: k.session_id } as AssistantItem)
                                }
                              >
                                Retirer
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {others.length > 0 && (
                      <div>
                        <h4 className="mb-2 font-semibold">Aussi à ne pas manquer sur ce salon</h4>
                        <div className="divide-y divide-border">
                          {others.map((it) => (
                            <AssistantItemCard key={it.match_id} item={it} profileId={profileId} compact />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
