import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import EventCard from '@/components/radar-crm/RadarEventCard';
import DetailTable from '@/components/radar-crm/RadarDetailTable';
import { NoFutureMatches } from '@/components/radar-crm/RadarStates';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

const RadarUpcomingEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    radarView, loading, activeImportId, eventGroups, futureGroups, matchedCompanies,
    highlightedEventId, similarCounts, setSimilarCounts,
    getPref, getRel, setRel, enterTerrain, onClickEvent, onOpenMission,
  } = useRadarWorkspace();

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

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Salons à venir</h1>
        <RadarPageGate>
          <div className="space-y-10">
            {futureGroups.length === 0 ? (
              <NoFutureMatches companiesCount={kpiAnalyzed} matchedCount={kpiDetected} />
            ) : (
              <div className="space-y-6">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Target className="h-4 w-4 text-foreground shrink-0" />
                  Cliquez sur une entreprise pour préparer votre mission (statut, objectif, questions).
                </p>
                {futureGroups.map((g) => (
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
                      getPref={getPref}
                      getRel={getRel}
                      onSetRel={setRel}
                      onView={() => onClickEvent(g)}
                      onModeSalon={() => enterTerrain(g.event_id)}
                      onDebrief={() => navigate(`/radar-crm/debrief/${g.event_id}`)}
                      similarCount={similarCounts?.[g.event_id] ?? 0}
                      onCompanyClick={(c, id_exposant, stand, nom_exposant, needs_review) =>
                        onOpenMission(c, stand, g, nom_exposant)}
                    />
                  </div>
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
