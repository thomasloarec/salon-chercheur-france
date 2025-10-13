import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import { useUserExhibitors } from '@/hooks/useExhibitorAdmin';
import { useMyNovelties } from '@/hooks/useMyNovelties';
import { useLikedNovelties } from '@/hooks/useNoveltyLike';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarRange, Building2, Ticket } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { VisitorDashboard } from '@/components/agenda/VisitorDashboard';
import { ExhibitorDashboard } from '@/components/agenda/ExhibitorDashboard';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const Agenda = () => {
  const { user } = useAuth();
  const { data: events = [], isLoading, error } = useFavoriteEvents();
  const { data: userExhibitors = [] } = useUserExhibitors();
  const { data: myNovelties = [], isLoading: noveltiesLoading } = useMyNovelties();
  const { data: likedNovelties = [] } = useLikedNovelties();
  const [activeRole, setActiveRole] = useState<'visitor' | 'exhibitor'>('visitor');

  // Find next upcoming event
  const nextEvent = events.find(event => new Date(event.date_debut) >= new Date());
  const hasExhibitorAccess = userExhibitors.length > 0 || myNovelties.length > 0;

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
          {/* Header avec Role Switcher */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
              <CalendarRange className="h-8 w-8" />
              Mon agenda
            </h1>
            
            {/* Role Switcher - seulement si l'utilisateur est aussi exposant */}
            {hasExhibitorAccess ? (
              <div className="inline-flex rounded-lg border bg-white p-1 gap-1">
                <button
                  onClick={() => setActiveRole('visitor')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    activeRole === 'visitor'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Ticket className="h-4 w-4" />
                  Mode Visiteur
                  <Badge variant="secondary" className="ml-1">
                    {events.length + likedNovelties.length}
                  </Badge>
                </button>
                
                <button
                  onClick={() => setActiveRole('exhibitor')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    activeRole === 'exhibitor'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Espace Exposant
                  <Badge variant="secondary" className="ml-1">
                    {myNovelties.length}
                  </Badge>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <p className="text-gray-600">
                  {isLoading ? 'Chargement...' : `${events.length} salon(s) dans votre agenda`}
                </p>
                {nextEvent && (
                  <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                    Prochain : {format(new Date(nextEvent.date_debut), 'dd MMM yyyy', { locale: fr })}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Contenu conditionnel selon le rôle */}
          {activeRole === 'visitor' ? (
            <VisitorDashboard 
              events={events}
              likedNovelties={likedNovelties}
              isLoading={isLoading}
            />
          ) : (
            <ExhibitorDashboard 
              exhibitors={userExhibitors}
              novelties={myNovelties}
              isLoading={noveltiesLoading}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Agenda;
