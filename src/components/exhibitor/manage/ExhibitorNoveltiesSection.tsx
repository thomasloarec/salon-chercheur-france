import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Clock,
  Download,
  Edit,
  ExternalLink,
  Heart,
  MapPin,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import NoveltyDetailView from '@/components/novelty/NoveltyDetailView';
import { EditNoveltyDialog } from '@/components/novelty/EditNoveltyDialog';
import { EventPremiumStatus } from '@/components/agenda/EventPremiumStatus';
import { useMyNovelties, type MyNovelty } from '@/hooks/useMyNovelties';

function statusLabel(status: string) {
  if (status === 'published') return 'Publiée';
  if (status === 'draft') return 'Brouillon';
  return 'En révision';
}

interface ExhibitorNoveltiesSectionProps {
  exhibitorId: string;
  exhibitorName: string;
  exhibitorLogoUrl: string | null;
  exhibitorPublicSlug: string | null;
  hasUpcomingParticipation: boolean;
  onGoToSalons: () => void;
  onGoToRendezvous: () => void;
}

export default function ExhibitorNoveltiesSection({
  exhibitorId,
  exhibitorName,
  exhibitorLogoUrl,
  exhibitorPublicSlug,
  hasUpcomingParticipation,
  onGoToSalons,
  onGoToRendezvous,
}: ExhibitorNoveltiesSectionProps) {
  const { data: allNovelties = [], isLoading } = useMyNovelties(exhibitorId);
  const [editingNovelty, setEditingNovelty] = useState<MyNovelty | null>(null);

  const novelties = useMemo(() => {
    return allNovelties
      .filter((n) => !!n && n.exhibitors?.id === exhibitorId && !!n.events?.id)
      .slice()
      .sort((a, b) => {
        const ta = a.events?.date_debut ? new Date(a.events.date_debut).getTime() : 0;
        const tb = b.events?.date_debut ? new Date(b.events.date_debut).getTime() : 0;
        return ta - tb;
      });
  }, [allNovelties, exhibitorId]);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <Card className="p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 w-full" />
        </Card>
      ) : novelties.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          {hasUpcomingParticipation ? (
            <>
              <Rocket className="h-12 w-12 text-primary mx-auto" />
              <h3 className="text-lg font-semibold">
                Vous participez à un salon à venir : publiez une Nouveauté
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Une Nouveauté présente ce que vous montrerez sur votre stand. Elle est mise en avant
                sur la page du salon et vous permet de générer des leads avant même l'ouverture des
                portes.
              </p>
              <Button asChild>
                <Link to="/publier-nouveaute">Publier une Nouveauté</Link>
              </Button>
            </>
          ) : (
            <>
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">Aucune nouveauté pour le moment</h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Les Nouveautés se rattachent à un salon. Déclarez d'abord une participation à un
                salon à venir.
              </p>
              <Button variant="outline" onClick={onGoToSalons}>
                Aller à « Mes salons »
              </Button>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-10">
          {novelties.map((novelty) => {
            const isPending = novelty.status !== 'published';
            return (
              <div key={novelty.id} className="space-y-4">
                {/* Rappel du salon + statut */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      {novelty.events.slug ? (
                        <Link
                          to={`/events/${novelty.events.slug}`}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <MapPin className="h-4 w-4" />
                          {novelty.events.nom_event ?? 'Salon'}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {novelty.events.nom_event ?? 'Salon'}
                        </span>
                      )}
                      {novelty.events.date_debut && (
                        <span>
                          {format(new Date(novelty.events.date_debut), 'dd MMM yyyy', {
                            locale: fr,
                          })}
                        </span>
                      )}
                      <Badge variant={novelty.status === 'published' ? 'default' : 'secondary'}>
                        {statusLabel(novelty.status)}
                      </Badge>
                      <EventPremiumStatus
                        exhibitorId={novelty.exhibitors.id}
                        eventId={novelty.events.id}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => setEditingNovelty(novelty)}>
                        <Edit className="h-4 w-4 mr-1.5" />
                        Modifier
                      </Button>
                      {novelty.status === 'published' && novelty.slug && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/nouveautes/${novelty.slug}`}>
                            <ExternalLink className="h-4 w-4 mr-1.5" />
                            Voir la page publique
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted flex-shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          En attente de validation
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cette nouveauté sera visible sur la page du salon après validation par
                          l'administrateur.
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Non publiée
                      </Badge>
                    </div>
                  )}
                </Card>

                {/* Rendu identique à la page publique, en lecture seule */}
                <Card className={`p-6 ${isPending ? 'bg-muted/20' : ''}`}>
                  <NoveltyDetailView
                    preview
                    novelty={{
                      title: novelty.title,
                      type: novelty.type,
                      reason_1: novelty.reason_1 ?? null,
                      reason_2: novelty.reason_2 ?? null,
                      reason_3: novelty.reason_3 ?? null,
                      summary: novelty.summary ?? null,
                      details: novelty.details ?? null,
                      media_urls: novelty.media_urls ?? null,
                      doc_url: novelty.doc_url ?? null,
                      resource_url: novelty.resource_url ?? null,
                      stand_info: novelty.stand_info ?? null,
                      exhibitor_display_name: exhibitorName,
                      exhibitor_logo_url: exhibitorLogoUrl,
                      exhibitor_public_slug: exhibitorPublicSlug,
                      event_slug: novelty.events.slug,
                      event_name: novelty.events.nom_event,
                      event_date_debut: novelty.events.date_debut,
                      event_ville: novelty.events.ville,
                    }}
                  />
                </Card>

                {/* Performances (les listes de contacts sont dans l'onglet Rendez-vous) */}
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Performances
                    </h3>
                    <Button variant="outline" size="sm" onClick={onGoToRendezvous}>
                      Voir les contacts
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-danger-surface">
                        <Heart className="h-4 w-4 text-danger" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{novelty.stats?.likes || 0}</p>
                        <p className="text-xs text-muted-foreground">Likes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-info/10">
                        <Download className="h-4 w-4 text-info" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{novelty.stats?.brochure_leads || 0}</p>
                        <p className="text-xs text-muted-foreground">Téléchargements</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-info/10">
                        <CalendarCheck className="h-4 w-4 text-info" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{novelty.stats?.meeting_leads || 0}</p>
                        <p className="text-xs text-muted-foreground">Rendez-vous</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {editingNovelty && (
        <EditNoveltyDialog
          novelty={editingNovelty}
          open
          onOpenChange={(open) => !open && setEditingNovelty(null)}
        />
      )}
    </div>
  );
}
