import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Separator } from '@/components/ui/separator';
import { Building2, Eye, Edit, MapPin, Calendar, Sparkles, Heart, Download, CalendarCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import NoveltyLeadsDisplay from '@/components/novelty/NoveltyLeadsDisplay';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import LeadCaptureCard from '@/components/novelty/LeadCaptureCard';
import { EditNoveltyDialog } from '@/components/novelty/EditNoveltyDialog';
import { EventPremiumStatus } from './EventPremiumStatus';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import type { MyNovelty } from '@/hooks/useMyNovelties';

interface ExhibitorDashboardProps {
  exhibitors: any[];
  novelties: MyNovelty[];
}

export function ExhibitorDashboard({ exhibitors, novelties }: ExhibitorDashboardProps) {
  const [editingNovelty, setEditingNovelty] = useState<MyNovelty | null>(null);

  const handleEdit = (novelty: MyNovelty) => {
    setEditingNovelty(novelty);
  };

  // Check for Lead Capture Beta feature flag
  const LEAD_CAPTURE_BETA = true; // Feature flag

  return (
    <div className="space-y-6">
      {/* Banner explicatif */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">
              Espace professionnel exposant
            </h3>
            <p className="text-sm text-green-700">
              Gérez vos nouveautés, suivez vos statistiques et consultez vos leads générés sur les salons.
            </p>
          </div>
        </div>
      </div>

      {/* Contenu direct : Nouveautés */}
      {novelties.length > 0 ? (
        <div className="space-y-6">
          {novelties.map((novelty) => (
            <div key={novelty.id} className="space-y-4">
              {/* En-tête avec événement et actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Link 
                    to={`/events/${novelty.events.slug}`}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <MapPin className="h-4 w-4" />
                    {novelty.events.nom_event}
                  </Link>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(novelty.events.date_debut), 'dd MMM yyyy', { locale: fr })}
                  </span>
                  <Badge variant={novelty.status === 'published' ? 'default' : 'secondary'}>
                    {novelty.status === 'published' ? 'Publié' : 'En attente'}
                  </Badge>
                  <EventPremiumStatus 
                    exhibitorId={novelty.exhibitors.id}
                    eventId={novelty.events.id}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/events/${novelty.events.slug}#nouveautes`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Voir
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => handleEdit(novelty)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                </div>
              </div>

              {/* Carte de nouveauté avec leads en 2 colonnes */}
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-[1.4fr,1fr] gap-6">
                    {/* Colonne gauche : Nouveauté (60% width) */}
                    <div>
                      <NoveltyCard 
                        novelty={{
                          id: novelty.id,
                          event_id: novelty.events.id,
                          exhibitor_id: novelty.exhibitors.id,
                          title: novelty.title,
                          type: novelty.type,
                          reason_1: novelty.reason_1,
                          reason_2: undefined,
                          reason_3: undefined,
                          media_urls: novelty.media_urls,
                          stand_info: novelty.stand_info,
                          doc_url: novelty.doc_url,
                          availability: undefined,
                          audience_tags: undefined,
                          status: novelty.status,
                          created_at: novelty.created_at,
                          updated_at: novelty.created_at,
                          exhibitors: {
                            id: novelty.exhibitors.id,
                            name: novelty.exhibitors.name,
                            slug: novelty.exhibitors.slug,
                            logo_url: novelty.exhibitors.logo_url
                          }
                        }}
                      />
                    </div>

                    {/* Colonne droite : Leads (40% width) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Leads
                          <Badge variant="secondary" className="ml-1">
                            {novelty.stats?.total_leads || 0}
                          </Badge>
                        </h4>
                      </div>

                      {/* Lead Capture Beta Card */}
                      {LEAD_CAPTURE_BETA && (() => {
                        const { data: entitlement } = usePremiumEntitlement(novelty.exhibitors.id, novelty.events.id);
                        const isPremium = entitlement?.isPremium ?? false;
                        
                        return (
                          <LeadCaptureCard
                            isPremium={isPremium}
                            exhibitorId={novelty.exhibitors.id}
                            eventId={novelty.events.id}
                            eventName={novelty.events.nom_event}
                            eventDate={novelty.events.date_debut}
                            eventSlug={novelty.events.slug}
                          />
                        );
                      })()}

                      {/* Statistiques compactes */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/30">
                            <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">{novelty.stats?.likes || 0}</p>
                            <p className="text-xs text-muted-foreground">Likes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/30">
                            <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{novelty.stats?.brochure_leads || 0}</p>
                            <p className="text-xs text-muted-foreground">Téléchargements</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/30">
                            <CalendarCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{novelty.stats?.meeting_leads || 0}</p>
                            <p className="text-xs text-muted-foreground">Rendez-vous</p>
                          </div>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Liste des leads */}
                      <NoveltyLeadsDisplay 
                        noveltyId={novelty.id}
                        exhibitorId={novelty.exhibitors.id}
                        eventId={novelty.events.id}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Séparation plus marquée entre nouveautés */}
              {novelties.indexOf(novelty) < novelties.length - 1 && (
                <div className="my-12">
                  <Separator className="bg-border/50" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              Aucune nouveauté créée
            </h3>
            <p className="text-gray-500 mb-6">
              Publiez vos innovations sur les salons pour attirer des visiteurs
            </p>
            <Button asChild>
              <Link to="/events">Publier une nouveauté</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Novelty Dialog */}
      {editingNovelty && (
        <EditNoveltyDialog
          novelty={editingNovelty}
          open={!!editingNovelty}
          onOpenChange={(open) => !open && setEditingNovelty(null)}
        />
      )}
    </div>
  );
}
