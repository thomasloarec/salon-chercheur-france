
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import { useUserExhibitors } from '@/hooks/useExhibitorAdmin';
import { useMyNovelties } from '@/hooks/useMyNovelties';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarRange, Calendar, Heart, Download, MapPin, Users, Sparkles, Building2, Eye, Edit } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import ExhibitorLeadsPanel from '@/components/agenda/ExhibitorLeadsPanel';
import NoveltyLeadsDisplay from '@/components/novelty/NoveltyLeadsDisplay';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const NOVELTY_TYPE_LABELS = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre spéciale',
  Talk: 'Conférence'
};

const Agenda = () => {
  const { user } = useAuth();
  const { data: events = [], isLoading, error } = useFavoriteEvents();
  const { data: userExhibitors = [] } = useUserExhibitors();
  const { data: myNovelties = [], isLoading: noveltiesLoading } = useMyNovelties();
  const [activeTab, setActiveTab] = useState('events');

  // Find next upcoming event
  const nextEvent = events.find(event => new Date(event.date_debut) >= new Date());
  const hasExhibitorAccess = userExhibitors.length > 0;

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
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
              <CalendarRange className="h-8 w-8 text-primary" />
              Mon agenda
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-gray-600">
                {isLoading ? 'Chargement...' : `${events.length} salon(s) dans votre agenda`}
              </p>
              {nextEvent && (
                <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                  Prochain : {format(new Date(nextEvent.date_debut), 'dd MMM yyyy', { locale: fr })}
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Mes salons
              </TabsTrigger>
              <TabsTrigger value="novelties" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Mes nouveautés
                {myNovelties.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{myNovelties.length}</Badge>
                )}
              </TabsTrigger>
              {hasExhibitorAccess && (
                <TabsTrigger value="exhibitor" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Espace Exposant
                </TabsTrigger>
              )}
            </TabsList>

            {/* Events Tab */}
            <TabsContent value="events" className="mt-6">
              {isLoading ? (
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-16 w-16 bg-gray-200 rounded-lg"></div>
                        <div className="flex-1">
                          <div className="h-5 bg-gray-200 rounded mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-20 bg-gray-200 rounded"></div>
                        <div className="h-20 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-6">
                  {events.map((event) => (
                    <div key={event.id} className="bg-white rounded-lg shadow-sm border p-6">
                      {/* Event Header */}
                      <div className="flex items-start gap-4 mb-4">
                        {event.url_image && (
                          <img
                            src={event.url_image}
                            alt={event.nom_event}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-semibold">{event.nom_event}</h3>
                            {event.secteur && event.secteur.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {Array.isArray(event.secteur) ? event.secteur[0] : event.secteur}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(event.date_debut), 'dd MMM', { locale: fr })}
                            {event.date_fin !== event.date_debut && 
                              ` - ${format(new Date(event.date_fin), 'dd MMM', { locale: fr })}`
                            } • {event.ville}
                            {event.nom_lieu && ` • ${event.nom_lieu}`}
                          </div>
                        </div>
                        <Link to={`/events/${event.slug}`}>
                          <Button variant="outline" size="sm">
                            Voir le salon
                          </Button>
                        </Link>
                      </div>

                      {/* Event Description */}
                      {event.description_event && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {event.description_event}
                          </p>
                        </div>
                      )}

                      {/* Action to view novelties */}
                      <div className="mt-4 pt-4 border-t">
                        <Link to={`/events/${event.slug}#nouveautes`}>
                          <Button variant="outline" size="sm" className="w-full">
                            <Heart className="h-4 w-4 mr-2 text-red-500" />
                            Découvrir les nouveautés de ce salon
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg">
                  <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    Votre agenda est vide
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Likez des nouveautés pour les retrouver ici avec leurs salons
                  </p>
                  <Button asChild>
                    <Link to="/events">Découvrir les salons</Link>
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* My Novelties Tab */}
            <TabsContent value="novelties" className="mt-6">
              {noveltiesLoading ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden animate-pulse">
                      <div className="aspect-video bg-gray-200"></div>
                      <CardContent className="p-6">
                        <div className="h-6 bg-gray-200 rounded mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : myNovelties.length > 0 ? (
                <div className="space-y-6">
                  {myNovelties.map((novelty) => (
                    <Card key={novelty.id} className="overflow-hidden">
                      {/* Header avec actions */}
                      <div className="flex items-center justify-between p-6 border-b">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold">{novelty.title}</h2>
                            <Badge 
                              variant={novelty.status === 'Published' ? 'default' : 'secondary'}
                            >
                              {novelty.status === 'Published' ? 'Publié' : 
                               novelty.status === 'Draft' ? 'En attente' : novelty.status}
                            </Badge>
                            <Badge variant="outline">
                              {NOVELTY_TYPE_LABELS[novelty.type as keyof typeof NOVELTY_TYPE_LABELS] || novelty.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {novelty.exhibitors.name}
                            </div>
                            <span>•</span>
                            <Link 
                              to={`/events/${novelty.events.slug}`} 
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <MapPin className="h-4 w-4" />
                              {novelty.events.nom_event}
                            </Link>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(novelty.events.date_debut), 'dd MMM', { locale: fr })}
                              {novelty.events.date_fin !== novelty.events.date_debut && 
                                ` - ${format(new Date(novelty.events.date_fin), 'dd MMM yyyy', { locale: fr })}`
                              }
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button variant="outline" asChild size="sm">
                            <Link to={`/events/${novelty.events.slug}#nouveautes`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir sur le salon
                            </Link>
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => {
                              toast("Fonctionnalité en cours de développement", {
                                description: "La modification des nouveautés sera bientôt disponible"
                              });
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </Button>
                        </div>
                      </div>
                      
                      {/* Body: Image + Stats */}
                      <div className="grid md:grid-cols-[300px,1fr] gap-6 p-6">
                        {/* Image principale */}
                        {novelty.media_urls && novelty.media_urls[0] && (
                          <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                            <img
                              src={novelty.media_urls[0]}
                              alt={novelty.title}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        
                        {/* Stats + Description */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 bg-muted/30">
                              <div className="flex items-center gap-2 mb-2">
                                <Heart className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-sm">Likes</span>
                              </div>
                              <p className="text-3xl font-bold">
                                {novelty.novelty_stats?.route_users_count || 0}
                              </p>
                            </Card>
                            <Card className="p-4 bg-muted/30">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-sm">Popularité</span>
                              </div>
                              <p className="text-3xl font-bold">
                                {novelty.novelty_stats?.popularity_score || 0}
                              </p>
                            </Card>
                          </div>
                          
                          {novelty.reason_1 && (
                            <div>
                              <h3 className="font-semibold mb-2">Description</h3>
                              <p className="text-muted-foreground leading-relaxed">
                                {novelty.reason_1}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Section Leads */}
                      <div className="p-6 border-t bg-muted/20">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Leads
                        </h3>
                        <NoveltyLeadsDisplay 
                          noveltyId={novelty.id} 
                          isPremium={novelty.is_premium || false}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg">
                  <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    Aucune nouveauté créée
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Publiez vos innovations sur les salons pour attirer plus de visiteurs
                  </p>
                  <Button asChild>
                    <Link to="/events">Découvrir les salons</Link>
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Exhibitor Tab */}
            {hasExhibitorAccess && (
              <TabsContent value="exhibitor" className="mt-6">
                <ExhibitorLeadsPanel exhibitors={userExhibitors} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default Agenda;
