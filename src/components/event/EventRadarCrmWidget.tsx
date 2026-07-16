import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radar, Building2, ArrowRight, Loader2, AlertCircle, Lock } from 'lucide-react';
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

/** Conteneur carte commun aux états (cohérent avec EventAboutSidebar). */
const WidgetShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section
    className="rounded-xl border bg-card p-4 md:p-5 space-y-3"
    aria-label="Radar CRM"
  >
    <div className="flex items-center gap-2">
      <Radar className="h-4 w-4 text-warning" />
      <h2 className="font-semibold text-lg">Radar CRM</h2>
    </div>
    {children}
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

  // Chargement (auth ou requête)
  if (authLoading || (user && isLoading)) {
    return (
      <WidgetShell>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-full" />
      </WidgetShell>
    );
  }

  if (!data) return null;

  // État d'erreur — la RPC gatée a échoué : on l'affiche, jamais un widget vide trompeur.
  if (isError) {
    return (
      <WidgetShell>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          Impossible de charger vos correspondances CRM pour le moment.
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => void refetch()}>
          Réessayer
        </Button>
      </WidgetShell>
    );
  }

  // État 2 — connecté, aucun import CRM
  if (data.status === 'no_imports') {
    return (
      <WidgetShell>
        <p className="text-sm text-muted-foreground">
          Importez votre fichier CRM pour voir si vos entreprises exposent sur ce salon.
        </p>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/radar-crm">Importer mon fichier</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 5 — import en cours
  if (data.status === 'processing') {
    return (
      <WidgetShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-warning" />
          Analyse CRM en cours…
        </div>
        <p className="text-xs text-muted-foreground/80">
          Vos correspondances seront bientôt disponibles.
        </p>
        <Button asChild variant="ghost" size="sm" className="w-full justify-start px-0">
          <Link to="/radar-crm/results" className="text-primary">Voir mon Radar CRM</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État optionnel — dernier import en échec
  if (data.status === 'failed') {
    return (
      <WidgetShell>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
          Votre dernier import CRM n'a pas pu être analysé.
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/radar-crm">Relancer un import</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 3 — connecté, import terminé, aucun match (discret)
  if (data.status === 'no_matches') {
    return (
      <WidgetShell>
        <p className="text-sm text-muted-foreground">
          Aucune entreprise de votre fichier détectée sur ce salon pour le moment.
        </p>
        <Button asChild variant="ghost" size="sm" className="w-full justify-start px-0">
          <Link to="/radar-crm/results" className="text-primary">Voir mon Radar CRM</Link>
        </Button>
      </WidgetShell>
    );
  }

  // État verrouillé — accès expiré/free : la RPC dédiée ne renvoie NI compteur NI
  // identités, seulement `has_matches`. On affiche un message générique sans nombre
  // + pastilles floutées génériques, cohérent avec le paywall de la page Radar CRM.
  if (data.status === 'locked') {
    return (
      <WidgetShell>
        <p className="text-sm text-foreground">
          Une ou plusieurs entreprises de votre CRM exposent à ce salon.
        </p>
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2"
            >
              <span className="h-7 w-7 flex-shrink-0 rounded bg-muted blur-[1px]" />
              <span className="h-3 flex-1 rounded bg-muted blur-[1px]" style={{ maxWidth: `${60 + i * 20}%` }} />
              <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
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
            <Lock className="h-4 w-4 mr-1.5" />
            Débloquer
          </Link>
        </Button>
      </WidgetShell>
    );
  }

  // État 4 — connecté avec matches sur cet événement
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
    <WidgetShell>
      <p className="text-sm text-foreground">
        <strong>{data.total}</strong> entreprise{data.total > 1 ? 's' : ''} de votre CRM
        {data.total > 1 ? ' exposent' : ' expose'} sur ce salon
      </p>

      <ul className="space-y-2">
        {visible.map((m) => {
          const showExhibitor =
            m.exhibitorName &&
            m.exhibitorName.trim().toLowerCase() !== m.crmCompanyName.trim().toLowerCase();
          const logoUrl = getExhibitorLogoUrl(null, m.website);
          return (
            <li
              key={m.crmCompanyId}
            >
              <button
                type="button"
                onClick={() => openExhibitor(m)}
                className="w-full flex items-start gap-2 rounded-lg border bg-muted/30 px-2.5 py-2 text-left transition-colors hover:bg-muted/60 hover:border-primary/40"
              >
                <span className="h-7 w-7 flex-shrink-0 rounded bg-background border flex items-center justify-center overflow-hidden p-0.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={m.crmCompanyName}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {m.crmCompanyName}
                </p>
                {showExhibitor && (
                  <p className="text-xs text-muted-foreground truncate">
                    Exposant : {m.exhibitorName}
                  </p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {m.stand && (
                    <span className="text-xs text-muted-foreground">Stand {m.stand}</span>
                  )}
                  {m.needsReview && (
                    <span className="text-[10px] font-medium text-warning">à vérifier</span>
                  )}
                </div>
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
          <ArrowRight className="h-4 w-4 ml-1" />
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