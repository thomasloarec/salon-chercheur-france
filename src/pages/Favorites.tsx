
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import EventCard from '@/components/EventCard';
import { Button } from '@/components/ui/button';
import { Heart, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { convertSecteurToString } from '@/utils/sectorUtils';
import type { Event } from '@/types/event';
import MainLayout from '@/components/layout/MainLayout';

const Favorites = () => {
  const { user } = useAuth();
  const { data: favorites, isLoading, error } = useFavorites();

  if (!user) {
    return (
      <MainLayout title="Mes événements favoris">
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <Heart className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="heading-display text-2xl text-foreground mb-2">
              Connectez-vous pour voir vos favoris
            </h2>
            <p className="text-muted-foreground mb-6">
              Sauvegardez vos événements préférés pour les retrouver facilement
            </p>
            <Button asChild>
              <Link to="/auth">Se connecter</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="Mes événements favoris">
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive">Erreur lors du chargement des favoris</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Mes événements favoris">
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="heading-display text-3xl text-foreground flex items-center gap-2">
              <Heart className="h-8 w-8 text-primary" />
              Mes événements favoris
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLoading ? 'Chargement...' : `${favorites?.length || 0} événement(s) sauvegardé(s)`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-lg p-6 animate-pulse">
                  <div className="h-48 bg-muted rounded-lg mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : favorites && favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite) => {
                if (!favorite.events) return null;
                
                // Transform the favorite data to match Event type with proper field mapping
                const eventData: Event = {
                  id: (favorite.events as any).id,  // Utiliser l'UUID directement
                  nom_event: (favorite.events as any).nom_event || '',
                  description_event: (favorite.events as any).description_event,
                  date_debut: (favorite.events as any).date_debut,
                  date_fin: (favorite.events as any).date_fin,
                  secteur: convertSecteurToString((favorite.events as any).secteur),
                  nom_lieu: (favorite.events as any).nom_lieu,
                  ville: (favorite.events as any).ville,
                  country: (favorite.events as any).pays,
                  url_image: (favorite.events as any).url_image,
                  url_site_officiel: (favorite.events as any).url_site_officiel,
                  tags: [],
                  tarif: (favorite.events as any).tarif,
                  affluence: (favorite.events as any).affluence,
                  estimated_exhibitors: undefined,
                  is_b2b: (favorite.events as any).is_b2b,
                  type_event: (favorite.events as any).type_event as Event['type_event'],
                  created_at: (favorite.events as any).created_at,
                  updated_at: (favorite.events as any).updated_at,
                  last_scraped_at: undefined,
                  scraped_from: undefined,
                  rue: (favorite.events as any).rue,
                  code_postal: (favorite.events as any).code_postal,
                  visible: (favorite.events as any).visible,
                  slug: (favorite.events as any).slug,
                  sectors: []
                };

                return (
                  <EventCard 
                    key={favorite.id} 
                    event={eventData}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Aucun favori pour le moment
              </h3>
              <p className="text-muted-foreground mb-6">
                Explorez nos événements et ajoutez-les à vos favoris
              </p>
              <Button asChild>
                <Link to="/events">Découvrir les événements</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Favorites;
