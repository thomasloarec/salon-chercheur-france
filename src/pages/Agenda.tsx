import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { data: allEvents = [], isLoading, error } = useFavoriteEvents();
  const { data: userExhibitors = [] } = useUserExhibitors();
  const { data: myNovelties = [], isLoading: noveltiesLoading } = useMyNovelties();
  const { data: likedNovelties = [] } = useLikedNovelties();
  
  // Initialize role from URL param ?tab=exposant
  const initialRole = searchParams.get('tab') === 'exposant' ? 'exhibitor' : 'visitor';
  const [activeRole, setActiveRole] = useState<'visitor' | 'exhibitor'>(initialRole);
  
  // Sync role when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'exposant') {
      setActiveRole('exhibitor');
    }
  }, [searchParams]);

  // Filter events: only upcoming or ongoing for visitor mode
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Fusionner avec les événements issus des nouveautés likées (filet de
  // sécurité au cas où l'auto-favori n'aurait pas pu s'appliquer).
  const favoriteIds = new Set(allEvents.map((e: any) => e.id));
  const eventsFromNovelties = (likedNovelties as any[])
    .map((n) => n.events)
    .filter((e) => e && !favoriteIds.has(e.id))
    .reduce((acc: any[], e: any) => {
      if (!acc.some((x) => x.id === e.id)) acc.push(e);
      return acc;
    }, []);

  const mergedEvents = [...allEvents, ...eventsFromNovelties];

  const upcomingOrOngoingEvents = mergedEvents
    .filter((event: any) => {
      const endDate = new Date(event.date_fin || event.date_debut);
      endDate.setHours(23, 59, 59, 999);
      return endDate >= today;
    })
    // Sort chronologically: closest events first
    .sort((a: any, b: any) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());

  // Next event is now the first one in the sorted list
  const nextEvent = upcomingOrOngoingEvents[0];
  const hasExhibitorAccess = userExhibitors.length > 0 || myNovelties.length > 0;

  if (!user) {
    return (
      <MainLayout title="Mon agenda">
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <CalendarRange className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="heading-display text-2xl text-foreground mb-2">
              Connectez-vous pour voir votre agenda
            </h2>
            <p className="text-muted-foreground mb-6">
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
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive">Erreur lors du chargement de votre agenda</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Mon agenda">
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header avec Role Switcher */}
          <div className="mb-8">
            <h1 className="heading-display text-3xl text-foreground mb-4 flex items-center gap-2">
              <CalendarRange className="h-8 w-8" />
              Mon agenda
            </h1>
            
            {/* Role Switcher - seulement si l'utilisateur est aussi exposant */}
            {hasExhibitorAccess ? (
              <div className="inline-flex rounded-lg border bg-card p-1 gap-1">
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
                    {upcomingOrOngoingEvents.length + likedNovelties.length}
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
                <p className="text-muted-foreground">
                  {isLoading ? 'Chargement...' : `${upcomingOrOngoingEvents.length} salon(s) dans votre agenda`}
                </p>
                {nextEvent && (
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
                    Prochain : {format(new Date(nextEvent.date_debut), 'dd MMM yyyy', { locale: fr })}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Contenu conditionnel selon le rôle */}
          {activeRole === 'visitor' ? (
            <VisitorDashboard 
              events={upcomingOrOngoingEvents}
              likedNovelties={likedNovelties}
              isLoading={isLoading}
            />
          ) : (
            <ExhibitorDashboard 
              exhibitors={userExhibitors}
              novelties={myNovelties}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Agenda;
