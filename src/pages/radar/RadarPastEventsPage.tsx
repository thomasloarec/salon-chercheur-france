import React, { useEffect, useState } from 'react';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import { EmptyText, formatDate } from '@/components/radar-crm/RadarShared';
import EventDebriefPanel, { type DebriefSummary } from '@/components/radar-crm/EventDebriefPanel';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';
import { Card } from '@/components/ui/card';
import { ChevronDown, MapPin, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type EventGroup } from '@/types/radar';

/** Ligne de résumé d'activité, disponible une fois le panneau chargé. */
const summaryLine = (s: DebriefSummary | undefined, companyCount: number): string => {
  if (!s) return `${companyCount} compte${companyCount > 1 ? 's' : ''} suivi${companyCount > 1 ? 's' : ''}`;
  return [
    `${s.worked} entreprise${s.worked > 1 ? 's' : ''} travaillée${s.worked > 1 ? 's' : ''}`,
    `${s.notes} note${s.notes > 1 ? 's' : ''}`,
    `${s.tasks} tâche${s.tasks > 1 ? 's' : ''}`,
  ].join(' · ');
};

const PastEventRow: React.FC<{
  group: EventGroup;
  open: boolean;
  onToggle: () => void;
  onOpenEvent: () => void;
}> = ({ group, open, onToggle, onOpenEvent }) => {
  const [summary, setSummary] = useState<DebriefSummary | undefined>(undefined);

  return (
    <Card className="overflow-hidden border-border/60 shadow-none bg-card">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="w-full text-left px-4 py-4 md:px-5 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenEvent(); }}
            disabled={!group.slug}
            className="font-display text-base font-semibold text-foreground leading-tight hover:text-primary text-left"
          >
            {group.nom_event}
          </button>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(group.date_debut)}
            </span>
            {group.ville && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {group.ville}</span>
            )}
          </p>
          <p className="text-sm text-foreground/70 mt-1.5">{summaryLine(summary, group.companies.length)}</p>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform mt-0.5', open && 'rotate-180')}
          aria-hidden="true"
        />
      </div>

      {/* Chargement paresseux : le panneau (et donc la RPC) n'existe qu'une fois déplié. */}
      {open && (
        <div className="border-t border-border/60 px-4 py-5 md:px-5 bg-muted/10">
          <EventDebriefPanel
            eventId={group.event_id}
            event={{
              event_id: group.event_id,
              nom_event: group.nom_event,
              ville: group.ville,
              date_debut: group.date_debut,
              date_fin: group.date_fin,
            }}
            onSummary={setSummary}
          />
        </div>
      )}
    </Card>
  );
};

const RadarPastEventsPage: React.FC = () => {
  const { pastGroups, onClickEvent } = useRadarWorkspace();
  // Le salon le plus récent est déplié d'emblée : c'est celui qui vient de se terminer.
  const [openId, setOpenId] = useState<string | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  useEffect(() => {
    if (autoOpened || pastGroups.length === 0) return;
    setOpenId(pastGroups[0].event_id);
    setAutoOpened(true);
  }, [autoOpened, pastGroups]);

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Salons passés</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Retrouvez les notes, tâches et rencontres de chaque salon.
          </p>
        </div>
        <RadarPageGate>
          {pastGroups.length === 0 ? (
            <EmptyText label="Aucun salon passé détecté pour vos comptes surveillés." />
          ) : (
            <div className="space-y-4">
              {pastGroups.map((g) => (
                <PastEventRow
                  key={g.event_id}
                  group={g}
                  open={openId === g.event_id}
                  onToggle={() => setOpenId((cur) => (cur === g.event_id ? null : g.event_id))}
                  onOpenEvent={() => onClickEvent(g)}
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
