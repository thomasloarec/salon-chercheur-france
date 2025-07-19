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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-600 mb-2">
              Connectez-vous pour voir vos favoris
            </h2>
            <p className="text-gray-500 mb-6">
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600">Erreur lors du chargement des favoris</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Mes événements favoris">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
              <Heart className="h-8 w-8 text-red-500" />
              Mes événements favoris
            </h1>
            <p className="text-gray-600 mt-2">
              {isLoading ? 'Chargement...' : `${favorites?.length || 0} événement(s) sauvegardé(s)`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
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
                  id: favorite.events.id,
                  nom_event: favorite.events.nom_event || '',
                  description_event: favorite.events.description_event,
                  date_debut: favorite.events.date_debut,
                  date_fin: favorite.events.date_fin,
                  secteur: convertSecteurToString(favorite.events.secteur),
                  nom_lieu: favorite.events.nom_lieu,
                  ville: favorite.events.ville,
                  // Region no longer exists in events table
                  country: favorite.events.pays,
                  url_image: favorite.events.url_image,
                  url_site_officiel: favorite.events.url_site_officiel,
                  tags: favorite.events.tags,
                  tarif: favorite.events.tarif,
                  affluence: favorite.events.affluence,
                  estimated_exhibitors: favorite.events.estimated_exhibitors,
                  is_b2b: favorite.events.is_b2b,
                  type_event: favorite.events.type_event as Event['type_event'],
                  created_at: favorite.events.created_at,
                  updated_at: favorite.events.updated_at,
                  last_scraped_at: favorite.events.last_scraped_at,
                  scraped_from: favorite.events.scraped_from,
                  rue: favorite.events.rue,
                  code_postal: favorite.events.code_postal,
                  visible: favorite.events.visible,
                  slug: favorite.events.slug,
                  sectors: favorite.events.event_sectors?.map(es => ({
                    id: es.sectors.id,
                    name: es.sectors.name,
                    created_at: es.sectors.created_at,
                  })).filter(Boolean) || []
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
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Aucun favori pour le moment
              </h3>
              <p className="text-gray-500 mb-6">
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
