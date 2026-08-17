import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radar, ArrowRight, CalendarDays } from 'lucide-react';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import RadarModeSalonDemo from '@/components/radar-crm/RadarModeSalonDemo';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

const scrollToDemo = () => {
  document.getElementById('mode-salon-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const Stat: React.FC<{ value: React.ReactNode; label: string }> = ({ value, label }) => (
  <div className="rounded-lg border border-border bg-card px-4 py-3 min-w-[110px]">
    <p className="font-display text-2xl font-semibold text-foreground tabular-nums">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const HubContent: React.FC = () => {
  const { nextEvent, ongoingEvents } = useRadarWorkspace();
  const live = ongoingEvents[0] ?? null;

  const days = nextEvent?.days_until ?? null;
  const countdown =
    days === null ? null : days <= 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`;

  // `companies` n'est peuplé qu'en accès complet : ne jamais afficher un faux zéro.
  const companiesLoaded = (nextEvent?.companies?.length ?? 0) > 0;
  const starred = nextEvent?.companies?.filter((c) => c.pref_status === 'starred').length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-8">
      {live ? (
        <Card className="border-primary/40 bg-primary/5 p-5 space-y-3">
          <p className="text-sm font-medium text-primary flex items-center gap-2">
            <Radar className="h-4 w-4" /> Un salon est en cours aujourd'hui
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {live.nom_event}
          </h1>
          <Button asChild className="gap-2 min-h-[44px]">
            <Link to={`/radar-crm/terrain/${live.event_id}`}>
              Entrer en Mode Salon <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>
      ) : nextEvent ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Votre prochain salon : {nextEvent.nom_event}
            </h1>
            {countdown && (
              <p className="text-sm text-muted-foreground mt-1.5">
                {countdown === "Aujourd'hui"
                  ? "Aujourd'hui, le Mode Salon s'active automatiquement."
                  : `${countdown}, le Mode Salon s'activera automatiquement.`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Stat value={nextEvent.company_count} label="comptes présents" />
            {companiesLoaded && <Stat value={starred} label="prioritaires" />}
            <Stat value={days ?? '—'} label="jours restants" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2 min-h-[44px]">
              <Link to={`/radar-crm/salons?eventId=${nextEvent.event_id}`}>
                Préparer mes comptes <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={scrollToDemo} className="min-h-[44px]">
              Voir la démonstration
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Mode Salon
          </h1>
          <p className="text-sm text-muted-foreground">
            Aucun salon à venir dans votre radar pour l'instant.
          </p>
          <Button asChild variant="outline" className="gap-2 min-h-[44px]">
            <Link to="/radar-crm/salons">
              <CalendarDays className="h-4 w-4" /> Explorer les salons
            </Link>
          </Button>
        </div>
      )}

      <RadarModeSalonDemo />
    </div>
  );
};

const RadarModeSalonHub: React.FC = () => (
  <RadarPageGate>
    <HubContent />
  </RadarPageGate>
);

export default RadarModeSalonHub;
