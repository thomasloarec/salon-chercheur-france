import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, ArrowRight, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import MainLayout from '@/components/layout/MainLayout';
import { useEventsList } from '@/hooks/useEventsList';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PublierNouveaute() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data: events, isLoading } = useEventsList();

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    // Only future events
    const upcoming = events.filter(e => e.date_debut && new Date(e.date_debut) >= now);

    if (!search.trim()) {
      // Show next 12 events by date
      return upcoming
        .sort((a, b) => new Date(a.date_debut!).getTime() - new Date(b.date_debut!).getTime())
        .slice(0, 12);
    }

    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return upcoming
      .filter(e => {
        const haystack = [e.nom_event, e.ville, e.nom_lieu]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every(t => haystack.includes(t));
      })
      .sort((a, b) => new Date(a.date_debut!).getTime() - new Date(b.date_debut!).getTime())
      .slice(0, 20);
  }, [events, search]);

  return (
    <>
      <Helmet>
        <title>Publier une nouveauté – Trouvez votre salon | Lotexpo</title>
        <meta name="description" content="Trouvez votre salon professionnel et publiez gratuitement votre première nouveauté sur Lotexpo." />
      </Helmet>
      <MainLayout title="Publier une nouveauté">
        <section className="py-12 md:py-20">
          <div className="container max-w-4xl mx-auto px-4">
            {/* Header */}
            <div className="text-center space-y-4 mb-10">
              <h1 className="text-3xl md:text-4xl font-bold">
                Trouvez votre salon pour publier votre nouveauté
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Recherchez le salon professionnel auquel vous participez, puis publiez votre première nouveauté gratuitement.
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-xl mx-auto mb-10">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Recherchez votre salon (ex : Eurosatory, SIAL, JEC World…)"
                className="pl-12 h-14 text-base"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Results */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Chargement des événements…</div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-muted-foreground text-lg">Aucun salon trouvé pour « {search} »</p>
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <HelpCircle className="h-4 w-4" />
                  Vous ne trouvez pas votre événement ? Contactez-nous
                </a>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredEvents.map(event => (
                  <Card
                    key={event.id}
                    className="hover:border-primary/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/events/${event.slug}`)}
                  >
                    <CardContent className="p-5 flex flex-col gap-3">
                      <h3 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {event.nom_event}
                      </h3>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {event.date_debut && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(event.date_debut), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        )}
                        {event.ville && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.ville}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="mt-auto self-start gap-1"
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/events/${event.slug}`);
                        }}
                      >
                        Publier pour ce salon
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Help link */}
            {filteredEvents.length > 0 && search.trim() && (
              <div className="text-center mt-8">
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                >
                  <HelpCircle className="h-4 w-4" />
                  Vous ne trouvez pas votre événement ? Contactez-nous
                </a>
              </div>
            )}
          </div>
        </section>
      </MainLayout>
    </>
  );
}
