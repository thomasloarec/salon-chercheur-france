import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar, Mail, Star, Flame } from 'lucide-react';
import { type Company, type EventGroup, type Pref } from '@/types/radar';

/** Bandeau « radar actif » — cadrage veille : surveillance + imminence + réassurance email. */
const RadarActiveBanner: React.FC<{
  analyzed: number;
  futureCompanies: number;
  futureSalons: number;
  featured: { event: EventGroup; company: Company | null; isPriority: boolean } | null;
  starredCount: number;
  ongoing: EventGroup[];
  getPref?: (companyId: string) => Pref;
  onEnterTerrain: (eventId: string) => void;
  onClickEvent: (g: EventGroup) => void;
  onOpenSettings: () => void;
}> = ({ analyzed, futureCompanies, futureSalons, featured, starredCount, ongoing, getPref, onEnterTerrain, onClickEvent, onOpenSettings }) => {
  const ev = featured?.event ?? null;
  const isPriority = featured?.isPriority ?? false;
  const days = ev?.days_until != null ? Math.max(0, ev.days_until) : null;

  // Noms des comptes qui exposent au prochain salon : étoilés d'abord, ordre existant ensuite.
  const exposingNames = React.useMemo(() => {
    if (!ev) return [] as string[];
    const list = [...ev.companies];
    if (getPref) {
      list.sort((a, b) => {
        const sa = getPref(a.company.id) === 'starred' ? 0 : 1;
        const sb = getPref(b.company.id) === 'starred' ? 0 : 1;
        return sa - sb;
      });
    }
    return list.map((c) => c.nom_exposant ?? c.company.company_name);
  }, [ev, getPref]);
  const shownNames = exposingNames.slice(0, 3);
  const restCount = Math.max(0, exposingNames.length - shownNames.length);

  // État « salon en cours aujourd'hui » — traitement distinct (live, mode terrain).
  if (ongoing.length > 0) {
    // Tous les salons en cours au même niveau (ordre alphabétique), aucun n'est mis en avant.
    const lives = [...ongoing].sort((x, y) => x.nom_event.localeCompare(y.nom_event, 'fr'));
    const several = lives.length > 1;
    return (
      <Card className="bg-primary/5 border-primary/40 shadow-none">
        <CardContent className="py-6 md:py-7 px-5 md:px-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="relative flex h-3 w-3 mt-1.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary mt-1">
              {several ? `${lives.length} salons en cours aujourd'hui` : "Salon en cours aujourd'hui"}
            </p>
          </div>

          <ul className={several ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
            {lives.map((ev) => (
              <li key={ev.event_id} className="rounded-lg border border-primary/20 bg-card p-4 flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-foreground leading-snug break-words">
                    {ev.nom_event}{ev.ville ? <span className="text-muted-foreground font-normal"> · {ev.ville}</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ev.company_count} de vos comptes {ev.company_count > 1 ? 'exposent' : 'expose'} ici.
                  </p>
                </div>
                <Button onClick={() => onEnterTerrain(ev.event_id)} className="mt-auto w-full min-h-[44px]">
                  <Radar className="h-4 w-4 mr-2" /> Entrer en mode salon
                </Button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
            Vous êtes alerté par email avant chaque salon concerné.
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-primary hover:underline font-medium"
            >
              Paramètres Radar CRM
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30 border-border/60 shadow-none">
      <CardContent className="py-6 md:py-7 px-5 md:px-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="relative flex h-3 w-3 mt-1.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-foreground leading-tight">Radar actif</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              On surveille <strong className="text-foreground">{analyzed}</strong> compte{analyzed > 1 ? 's' : ''} de votre CRM.{' '}
              <strong className="text-foreground">{futureCompanies}</strong> exposeront sur{' '}
              <strong className="text-foreground">{futureSalons}</strong> salon{futureSalons > 1 ? 's' : ''} à venir.
              {starredCount > 0 && (
                <> Vous suivez <strong className="text-foreground">{starredCount}</strong> compte{starredCount > 1 ? 's' : ''} en priorité.</>
              )}
            </p>
          </div>
        </div>

        {ev && (
          <button
            type="button"
            onClick={() => onClickEvent(ev)}
            disabled={!ev.slug}
            className="w-full text-left rounded-xl border border-primary/30 bg-card p-4 md:p-5 transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary flex items-center gap-1.5">
              {isPriority ? <Star className="h-3 w-3 fill-current" /> : <Flame className="h-3 w-3" />}
              {isPriority ? 'Compte prioritaire' : 'Prochain salon'}
            </p>
            {isPriority && featured?.company ? (
              <p className="text-base font-semibold text-foreground mt-2 leading-snug">
                <span className="text-primary">{featured.company.company_name}</span> expose à {ev.nom_event}
                {days != null && <span className="ml-1">dans {days} jour{days > 1 ? 's' : ''}</span>}
                {ev.ville ? ` · ${ev.ville}` : ''}
              </p>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground mt-2 leading-snug">
                  Prochain salon où vos comptes exposent : {ev.nom_event}
                  {days != null && <span className="ml-2 text-primary">dans {days} jour{days > 1 ? 's' : ''}</span>}
                </p>
                {shownNames.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-foreground font-medium">{shownNames.join(', ')}</span>
                    {restCount > 0 && <> et {restCount} autre{restCount > 1 ? 's' : ''}</>} y expose{exposingNames.length > 1 ? 'nt' : ''}
                    {ev.ville ? ` · ${ev.ville}` : ''}
                  </p>
                )}
              </>
            )}
          </button>
        )}

        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
          Vous êtes alerté par email avant chaque salon concerné.
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-primary hover:underline font-medium"
          >
            Paramètres Radar CRM
          </button>
        </p>
      </CardContent>
    </Card>
  );
};

export default RadarActiveBanner;
