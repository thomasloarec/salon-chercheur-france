
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import EventCard from '@/components/EventCard';
import FavoriteRow from '@/components/FavoriteRow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarRange, Calendar, Grid3X3, List, Download } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const Agenda = () => {
  const { user } = useAuth();
  const { data: events = [], isLoading, error } = useFavoriteEvents();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Persist view mode in localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('agenda-view-mode') as 'list' | 'grid' | null;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleViewModeChange = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('agenda-view-mode', mode);
  };

  // Find next upcoming event
  const nextEvent = events.find(event => new Date(event.start_date) >= new Date());

  if (!user) {
    return (
      <MainLayout title="Mon agenda">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <CalendarRange className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-600 mb-2">
              Connectez-vous pour voir votre agenda
            </h2>
            <p className="text-gray-500 mb-6">
              Organisez vos salons professionnels dans votre agenda personnel
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
      <MainLayout title="Mon agenda">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600">Erreur lors du chargement de votre agenda</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Mon agenda">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                  <CalendarRange className="h-8 w-8 text-primary" />
                  Mes salons à venir
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-gray-600">
                    {isLoading ? 'Chargement...' : `${events.length} salon(s) dans votre agenda`}
                  </p>
                  {nextEvent && (
                    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                      Prochain : {format(new Date(nextEvent.start_date), 'dd MMM yyyy', { locale: fr })}
                    </Badge>
                  )}
                </div>
              </div>

              {/* View Toggle & Export */}
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg p-1 bg-white">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewModeChange('list')}
                    className="px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewModeChange('grid')}
                    className="px-3"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
                
                {events.length > 0 && (
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter .ics
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 bg-gray-200 rounded-md"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : events.length > 0 ? (
            <>
              {viewMode === 'list' ? (
                <div className="bg-white rounded-lg shadow-sm">
                  <div role="list" className="divide-y divide-gray-100">
                    {events.map((event) => (
                      <div key={event.id} role="listitem">
                        <FavoriteRow event={event} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Votre agenda est vide
              </h3>
              <p className="text-gray-500 mb-6">
                Ajoutez des salons à vos favoris pour les retrouver ici
              </p>
              <Button asChild>
                <Link to="/events">Découvrir les salons</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Agenda;
