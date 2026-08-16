import React from 'react';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import PastEventCard from '@/components/radar-crm/RadarPastEventCard';
import { EmptyText } from '@/components/radar-crm/RadarShared';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

const RadarPastEventsPage: React.FC = () => {
  const { pastGroups, getRel, setRel, onClickEvent, onOpenExhibitor } = useRadarWorkspace();

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Salons passés</h1>
        <RadarPageGate>
          {pastGroups.length === 0 ? (
            <EmptyText label="Aucun salon passé détecté pour vos comptes surveillés." />
          ) : (
            <div className="space-y-6">
              {pastGroups.map((g) => (
                <PastEventCard
                  key={g.event_id}
                  group={g}
                  onView={() => onClickEvent(g)}
                  getRel={getRel}
                  onSetRel={setRel}
                  onCompanyClick={(c, id_exposant, stand, nom_exposant, needs_review) =>
                    onOpenExhibitor(c, id_exposant, stand, g, nom_exposant, needs_review)}
                />
              ))}
            </div>
          )}
        </RadarPageGate>
      </div>
    </div>
  );
};

export default RadarPastEventsPage;
