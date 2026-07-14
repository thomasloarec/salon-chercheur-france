import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Sparkles } from 'lucide-react';
import OrganizerEventEditForm from '@/components/event/OrganizerEventEditForm';
import SeoScorecard from '@/components/event/SeoScorecard';
import OrganizerActivationKit from '@/components/event/OrganizerActivationKit';
import OrganizerEmbedWidget from '@/components/event/OrganizerEmbedWidget';
import { useEventScorecard } from '@/hooks/useEventScorecard';
import type { Event } from '@/types/event';

const OrganizerSalonPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!slug) return;
      setLoading(true);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      const col = isUUID ? 'id' : 'slug';
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq(col, slug)
        .maybeSingle();
      if (cancelled) return;
      setEvent((data as any) ?? null);
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (authLoading || loading) return;
    if (!event) return;
    if (!user || !event.owner_user_id || user.id !== event.owner_user_id) {
      navigate(`/events/${event?.slug || slug}`, { replace: true });
    }
  }, [authLoading, loading, user, event, slug, navigate]);

  const { data: scorecardData } = useEventScorecard(event?.id, !!event);
  const c = (scorecardData as any)?.completude;
  const exposants = c?.exposants_references ?? 0;
  const pct = Math.max(0, Math.min(100, Number(c?.pct_enrichies ?? 0)));

  if (loading || authLoading) {
    return (
      <MainLayout title="Gérer mon salon">
        <div className="max-w-4xl mx-auto py-8 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!event) return null;
  if (!user || user.id !== event.owner_user_id) return null;

  return (
    <MainLayout title={`Gérer ${event.nom_event}`}>
      <div className="max-w-4xl mx-auto py-8 space-y-8">
        {/* En-tête */}
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Espace organisateur</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{event.nom_event}</h1>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/events/${event.slug || event.id}`}>
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Voir la page publique
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              {exposants} exposant{exposants > 1 ? 's' : ''} · {pct}% de fiches détaillées
            </Badge>
          </div>
        </header>

        {/* Section : Votre salon */}
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">Votre salon</h2>
            <p className="text-sm text-muted-foreground">
              Modifiez les informations principales. Vos changements seront soumis pour validation.
            </p>
          </div>
          <Card className="p-6">
            <OrganizerEventEditForm event={event} />
          </Card>
        </section>

        {/* Section : Vos exposants */}
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">Vos exposants</h2>
            <p className="text-sm text-muted-foreground">
              Suivez la complétude des fiches et la visibilité de votre salon dans les recherches IA.
            </p>
          </div>
          <SeoScorecard eventId={event.id} />
        </section>

        {/* Section : Activer vos exposants (placeholder Phase 6) */}
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">Activer vos exposants</h2>
            <p className="text-sm text-muted-foreground">
              Invitez vos exposants à compléter leur fiche et à publier leurs nouveautés.
            </p>
          </div>
          <OrganizerActivationKit
            event={{ id: event.id, slug: event.slug, nom_event: event.nom_event }}
          />
        </section>

        {/* Section : Widget nouveautés */}
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">Widget nouveautés pour votre site</h2>
            <p className="text-sm text-muted-foreground">
              Affichez les nouveautés de votre salon sur votre propre site. Copiez ce code et collez-le où vous le souhaitez.
            </p>
          </div>
          <OrganizerEmbedWidget slug={event.slug || event.id} nomEvent={event.nom_event} />
        </section>
      </div>
    </MainLayout>
  );
};

export default OrganizerSalonPage;