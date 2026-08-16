import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Target, List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import EventCard from '@/components/radar-crm/RadarEventCard';
import RadarCalendarView from '@/components/radar-crm/RadarCalendarView';
import DetailTable from '@/components/radar-crm/RadarDetailTable';
import { NoFutureMatches } from '@/components/radar-crm/RadarStates';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

const RadarUpcomingEventsPage: React.FC = () => {
  const {
    radarView, loading, activeImportId, eventGroups, futureGroups, matchedCompanies,
    highlightedEventId, similarCounts, setSimilarCounts,
    getPref, getRel, setRel, onClickEvent, onOpenMission,
  } = useRadarWorkspace();

  // Vue portée par l'URL (?vue=calendrier). `liste` est la valeur par défaut et n'y figure pas.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = !highlightedEventId && searchParams.get('vue') !== 'liste' ? 'calendrier' : 'liste';
  const setView = (next: 'liste' | 'calendrier') => {
    const params = new URLSearchParams(searchParams);
    params.delete('eventId');
    if (next === 'liste') params.set('vue', 'liste');
    else params.delete('vue');
    setSearchParams(params, { replace: true });
  };
  const selectFromCalendar = (g: { event_id: string }) => {
    const params = new URLSearchParams(searchParams);
    params.delete('vue');
    params.set('eventId', g.event_id);
    setSearchParams(params, { replace: true });
  };

  const summary = radarView?.summary;
  const kpiAnalyzed = summary?.companies_analyzed ?? 0;
  const kpiDetected = summary?.companies_detected ?? matchedCompanies.length;

  // Scroll to highlighted event once results are rendered.
  useEffect(() => {
    if (!highlightedEventId || loading) return;
    if (!eventGroups.find((g) => g.event_id === highlightedEventId)) return;
    const el = document.getElementById(`radar-event-${highlightedEventId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedEventId, loading, eventGroups]);

  // Comptage des similaires : appelé une seule fois à l'ouverture de la page.
  useEffect(() => {
    if (similarCounts !== null) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_radar_similar_counts');
      if (cancelled) return;
      if (error || !data || typeof data !== 'object') {
        setSimilarCounts({});
        return;
      }
      setSimilarCounts(data as Record<string, number>);
    })();
    return () => { cancelled = true; };
  }, [similarCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Regroupement par échéance — l'ordre interne de futureGroups est conservé.
  const sections = [
    { title: 'Ce mois-ci', items: futureGroups.filter((g) => (g.days_until ?? 9999) <= 31) },
    { title: 'Dans trois mois', items: futureGroups.filter((g) => (g.days_until ?? 9999) > 31 && (g.days_until ?? 9999) <= 92) },
    { title: 'Plus tard', items: futureGroups.filter((g) => (g.days_until ?? 9999) > 92) },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Salons à venir</h1>
          <div className="inline-flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground">Affichage</span>
            <div className="inline-flex items-center rounded-[var(--radius)] border border-border p-0.5 text-sm">
              {(['liste', 'calendrier'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1 capitalize transition-colors',
                    view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v === 'liste' ? <List className="h-[15px] w-[15px]" /> : <CalendarDays className="h-[15px] w-[15px]" />}
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <RadarPageGate>
          <div className="space-y-10">
            {futureGroups.length === 0 ? (
              <NoFutureMatches companiesCount={kpiAnalyzed} matchedCount={kpiDetected} />
            ) : view === 'calendrier' ? (
              <RadarCalendarView
                groups={futureGroups}
                highlightedEventId={highlightedEventId}
                onSelectEvent={selectFromCalendar}
              />
            ) : (
              <div className="space-y-6">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Target className="h-4 w-4 text-foreground shrink-0" />
                  Cliquez sur une entreprise pour préparer votre mission (statut, objectif, questions).
                </p>
                {sections.map(({ title, items }) => (
                  <section key={title} className="space-y-3">
                    <h2 className="text-xs text-muted-foreground">{title}</h2>
                    <div className="space-y-3">
                      {items.map((g, idx) => (
                        <div
                          key={g.event_id}
                          id={`radar-event-${g.event_id}`}
                          className={cn(
                            'transition-all rounded-lg',
                            highlightedEventId === g.event_id && 'ring-2 ring-primary ring-offset-2',
                          )}
                        >
                          <EventCard
                            group={g}
                            importId={activeImportId}
                            variant={idx === 0 || highlightedEventId === g.event_id ? 'detailed' : 'compact'}
                            getPref={getPref}
                            getRel={getRel}
                            onSetRel={setRel}
                            onView={() => onClickEvent(g)}
                            similarCount={similarCounts?.[g.event_id] ?? 0}
                            onCompanyClick={(c, id_exposant, stand, nom_exposant, needs_review) =>
                              onOpenMission(c, stand, g, nom_exposant)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Detail table (secondary) */}
            {eventGroups.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="detail" className="border rounded-lg bg-card px-4">
                  <AccordionTrigger className="text-sm text-foreground/70 hover:text-foreground">
                    Voir le détail en tableau (avancé)
                  </AccordionTrigger>
                  <AccordionContent>
                    <DetailTable groups={eventGroups} onView={onClickEvent} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </RadarPageGate>
      </div>
    </div>
  );
};

export default RadarUpcomingEventsPage;
