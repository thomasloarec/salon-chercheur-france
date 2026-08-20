import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radar, Building2, ArrowRight, Loader2, AlertCircle, Lock, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useEventCrmMatches } from '@/hooks/useEventCrmMatches';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import {
  fetchExhibitorPublicSlugs,
  resolvePublicSlug,
  type PublicSlugMaps,
} from '@/lib/exhibitorPublicSlug';
import { ExhibitorDetailDialog } from './ExhibitorDetailDialog';
import type { Event } from '@/types/event';

interface EventRadarCrmWidgetProps {
  event: Event;
  /** Masqué pour les événements passés (aucun match futur pertinent). */
  isEventPast?: boolean;
}

const MAX_VISIBLE = 4;

/**
 * Conteneur carte commun aux neuf états.
 * Lot 5 : en-tête navy, titre en heading-display (Playfair), corps en police
 * courante. Dimensions stables d'un état à l'autre pour éviter tout saut de
 * mise en page quand les données arrivent.
 */
const WidgetShell: React.FC<{ children: React.ReactNode; reveal?: boolean }> = ({
  children,
  reveal,
}) => (
  <section
    className="overflow-hidden rounded-xl border border-border bg-card"
    aria-label="Radar CRM"
  >
    <div className="flex items-center gap-2 bg-surface-inverse px-4 py-3">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-on-primary/20">
        <Radar className="h-4 w-4 text-on-primary" aria-hidden="true" />
      </span>
      <h2 className="heading-display text-base text-on">Radar CRM</h2>

    </div>
    <div className={`space-y-3 p-4 ${reveal ? 'radar-reveal' : ''}`}>{children}</div>
  </section>
);

/**
 * Widget compact sidebar : indique si des entreprises du CRM de l'utilisateur
 * exposent sur l'événement courant.
 *
 * Client-only : aucune donnée privée ne touche le HTML prérendu (#seo-prerender).
 * Les requêtes CRM ne s'exécutent que pour un utilisateur connecté.
 */
const EventRadarCrmWidget: React.FC<EventRadarCrmWidgetProps> = ({ event, isEventPast }) => {
  const { user, loading: authLoading } = useAuth();
  const eventId = event.id;

  // Exposant sélectionné -> ouverture de la popup détail existante.
  const [selectedExhibitor, setSelectedExhibitor] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, isError, refetch } = useEventCrmMatches(eventId, {
    enabled: !!user && !!eventId && !isEventPast,
    userId: user?.id ?? null,
  });

  // Résolution batchée des fiches publiques (/exposants/:slug) des exposants matchés,
  // pour pouvoir afficher le bouton « Voir la fiche complète » dans la popup détail.
  const matchedExposantIds =
    data?.status === 'has_matches'
      ? Array.from(new Set(data.matches.map((m) => m.idExposant).filter(Boolean)))
      : [];

  const { data: slugMaps } = useQuery({
    queryKey: ['crm-widget-exhibitor-slugs', eventId, matchedExposantIds],
    enabled: matchedExposantIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicSlugMaps> => {
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuids = matchedExposantIds.filter((id) => UUID_RE.test(id));
      const legacy = matchedExposantIds.filter((id) => !UUID_RE.test(id));
      return fetchExhibitorPublicSlugs(uuids, legacy);
    },
  });

  // Tracking : affichage avec matches (une seule fois par événement)
  const trackedRef = useRef(false);
  useEffect(() => {
    if (data?.status === 'has_matches' && !trackedRef.current) {
      trackedRef.current = true;
      void trackRadarEvent('crm_event_widget_viewed_with_matches', {
        eventId,
        count: data.total,
      });
    }
  }, [data, eventId]);

  // Événement passé : on masque le widget.
  if (isEventPast) return null;

  // État 1 — utilisateur non connecté : teaser, aucune requête privée.
  if (!authLoading && !user) {
    return (
      <WidgetShell>
        <p className="text-sm text-muted-foreground">
          Vous utilisez un CRM ? Découvrez si vos prospects exposent sur ce salon.
        </p>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link
            to="/radar-crm"
            onClick={() => void trackRadarEvent('crm_event_widget_teaser_clicked', { eventId })}
          >
            Tester Radar CRM
          </Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 2 — chargement (auth ou requête) : dimensions réservées, aucun CTA.
  if (authLoading || (user && isLoading)) {
    return (
      <WidgetShell>
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
              <Skeleton className="h-8 w-8 flex-shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-full" />
      </WidgetShell>
    );
  }

  // État 3 — erreur : la RPC gatée a échoué. Testé AVANT `!data`, sinon la branche
  // était inatteignable (en erreur, React Query ne renvoie aucune donnée).
  if (isError) {

    return (
      <WidgetShell>
        <div className="flex items-start gap-2 rounded-lg bg-danger-surface px-3 py-2.5 text-sm text-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
          Impossible de charger vos correspondances CRM pour le moment.
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => void refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Réessayer
        </Button>
      </WidgetShell>
    );
  }

  if (!data) return null;


  // État 4 — connecté, aucun import CRM
  if (data.status === 'no_imports') {
    return (
      <WidgetShell>
        <p className="text-sm text-muted-foreground">
          Importez votre fichier CRM pour voir si vos entreprises exposent sur ce salon.
        </p>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/radar-crm">
            <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Importer mon fichier
          </Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 5 — import en cours
  if (data.status === 'processing') {
    return (
      <WidgetShell>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" aria-hidden="true" />
          Analyse CRM en cours…
        </div>
        <p className="text-xs text-muted-foreground">
          Vos correspondances seront bientôt disponibles.
        </p>
        <Button asChild variant="ghost" size="sm" className="w-full justify-start px-0">
          <Link to="/radar-crm/results" className="text-primary">Voir mon Radar CRM</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 6 — dernier import en échec
  if (data.status === 'failed') {
    return (
      <WidgetShell>
        <div className="flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2.5 text-sm text-warning-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
          Votre dernier import CRM n'a pas pu être analysé.
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/radar-crm">Relancer un import</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 7 — connecté, import terminé, aucun match. Résultat NORMAL : ton neutre,
  // aucune iconographie d'erreur, aucune couleur d'alerte.
  if (data.status === 'no_matches') {
    return (
      <WidgetShell reveal>
        <p className="text-sm text-foreground">
          Aucune entreprise de votre CRM n'expose sur ce salon.
        </p>
        <p className="text-xs text-muted-foreground">
          Votre import est bien pris en compte : ce salon ne croise simplement pas votre
          portefeuille pour le moment.
        </p>
        <Button asChild variant="ghost" size="sm" className="w-full justify-start px-0">
          <Link to="/radar-crm/results" className="text-primary">Voir mon Radar CRM</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 8 — verrouillé : la RPC ne renvoie NI compteur NI identités, seulement
  // `has_matches`. Rien ici ne doit permettre de déduire un nombre : les
  // placeholders sont en nombre fixe (2) et sans rapport avec les données.
  if (data.status === 'locked') {
    return (
      <WidgetShell>
        <p className="text-sm text-foreground">
          Des entreprises de votre CRM exposent à ce salon.
        </p>
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2"
            >
              <span className="h-8 w-8 flex-shrink-0 rounded bg-muted blur-[2px]" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="block h-3 w-full rounded bg-muted blur-[2px]" />
                <span className="block h-2.5 w-1/2 rounded bg-muted blur-[2px]" />
              </span>
              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Débloquez pour voir quelles entreprises exposent et préparer vos rendez-vous.
        </p>
        <Button asChild size="sm" className="w-full">
          <Link
            to="/radar-crm/results"
            onClick={() => void trackRadarEvent('crm_access_requested', { source: 'event_widget', eventId })}
          >
            <Lock className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Débloquer
          </Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 9 — connecté avec matches sur cet événement
  const visible = data.matches.slice(0, MAX_VISIBLE);
  const remaining = data.total - visible.length;

  const openExhibitor = (m: (typeof data.matches)[number]) => {
    void trackRadarEvent('crm_event_widget_results_clicked', { eventId, count: data.total });
    const slugInfo = resolvePublicSlug(slugMaps, { legacyId: m.idExposant, exhibitorId: m.idExposant });
    setSelectedExhibitor({
      id_exposant: m.idExposant,
      exhibitor_name: m.exhibitorName ?? m.crmCompanyName,
      crm_company_name: m.crmCompanyName,
      needs_review: m.needsReview,
      stand_exposant: m.stand ?? undefined,
      website_exposant: m.website ?? undefined,
      public_slug: slugInfo?.public_slug ?? null,
      seo_indexable: slugInfo?.seo_indexable,
      is_test: slugInfo?.is_test,
    });
  };

  return (
    <>
      <WidgetShell reveal>
        <p className="text-sm text-foreground">
          <strong className="font-semibold">{data.total}</strong> entreprise{data.total > 1 ? 's' : ''} de votre CRM
          {data.total > 1 ? ' exposent' : ' expose'} sur ce salon.
        </p>

        <ul className="space-y-2">
          {visible.map((m) => {
            const showExhibitor =
              m.exhibitorName &&
              m.exhibitorName.trim().toLowerCase() !== m.crmCompanyName.trim().toLowerCase();
            const logoUrl = getExhibitorLogoUrl(null, m.website);
            return (
              <li key={m.crmCompanyId}>
                <button
                  type="button"
                  onClick={() => openExhibitor(m)}
                  className="flex w-full items-start gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-background p-0.5">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt=""
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Les raisons sociales CRM sont souvent longues : 2 lignes max,
                        ellipse ensuite, nom complet dans `title`. Pas de réduction
                        de la taille de police. */}
                    <span
                      className="line-clamp-2 break-words text-sm font-medium leading-snug text-foreground"
                      title={m.crmCompanyName}
                    >
                      {m.crmCompanyName}
                    </span>
                    {showExhibitor && (
                      <span
                        className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-muted-foreground"
                        title={m.exhibitorName ?? undefined}
                      >
                        Exposant : {m.exhibitorName}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {m.stand && (
                        <span className="inline-flex items-center rounded-full bg-bubble px-2 py-0.5 text-[11px] font-medium text-bubble-foreground">
                          Stand {m.stand}
                        </span>
                      )}
                      {m.needsReview && (
                        <span className="inline-flex items-center rounded-full border border-warning bg-warning-surface px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                          à vérifier
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            +{remaining} autre{remaining > 1 ? 's' : ''} entreprise{remaining > 1 ? 's' : ''} détectée{remaining > 1 ? 's' : ''}
          </p>
        )}

        <Button asChild size="sm" className="w-full">
          <Link
            to={`/radar-crm/results?eventId=${eventId}`}
            onClick={() => void trackRadarEvent('crm_event_widget_results_clicked', { eventId, count: data.total })}
          >
            Voir dans Radar CRM
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </WidgetShell>

      {/* Popup détail existante (description, site web, autres salons…) */}
      <ExhibitorDetailDialog
        open={!!selectedExhibitor}
        onOpenChange={(o) => !o && setSelectedExhibitor(null)}
        exhibitor={selectedExhibitor as never}
        event={event}
      />
    </>
  );
};

export default EventRadarCrmWidget;
