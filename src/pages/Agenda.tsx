import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import { useMyExhibitors } from '@/hooks/useMyExhibitors';
import { useLikedNovelties } from '@/hooks/useNoveltyLike';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarRange } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { VisitorDashboard } from '@/components/agenda/VisitorDashboard';
import { fetchExhibitorPublicSlugs } from '@/lib/exhibitorPublicSlug';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const Agenda = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: allEvents = [], isLoading, error } = useFavoriteEvents();
  const { data: likedNovelties = [] } = useLikedNovelties();
  const { data: memberships = [], isLoading: membershipsLoading } = useMyExhibitors();

  // Les anciens liens « espace exposant » redirigent vers la nouvelle page de
  // gestion de l'entreprise (ou vers le profil si l'utilisateur en gère
  // plusieurs).
  const wantsExhibitor =
    searchParams.get('tab') === 'exposant' || searchParams.get('section') === 'rendezvous';

  useEffect(() => {
    if (!wantsExhibitor || !user || membershipsLoading) return;
    let cancelled = false;
    const run = async () => {
      if (memberships.length !== 1) {
        navigate('/profile', { replace: true });
        return;
      }
      const exhibitorId = memberships[0].exhibitor_id;
      const slugs = await fetchExhibitorPublicSlugs([exhibitorId], []);
      if (cancelled) return;
      const info = slugs.byExhibitorId.get(exhibitorId);
      if (info && !info.is_test && info.public_slug) {
        navigate(`/exposants/${info.public_slug}/gerer`, { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [wantsExhibitor, user, memberships, membershipsLoading, navigate]);

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
    .sort((a: any, b: any) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());

  const nextEvent = upcomingOrOngoingEvents[0];

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
          <div className="mb-8">
            <h1 className="heading-display text-3xl text-foreground mb-4 flex items-center gap-2">
              <CalendarRange className="h-8 w-8" />
              Mon agenda
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-muted-foreground">
                {isLoading
                  ? 'Chargement...'
                  : `${upcomingOrOngoingEvents.length} salon(s) dans votre agenda`}
              </p>
              {nextEvent && (
                <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
                  Prochain : {format(new Date(nextEvent.date_debut), 'dd MMM yyyy', { locale: fr })}
                </Badge>
              )}
            </div>
          </div>

          <VisitorDashboard
            events={upcomingOrOngoingEvents}
            likedNovelties={likedNovelties}
            isLoading={isLoading}
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default Agenda;
