import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Sparkles, Building2, Users, Megaphone, Code, CalendarClock, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import OrganizerEventEditForm from '@/components/event/OrganizerEventEditForm';
import SeoScorecard from '@/components/event/SeoScorecard';
import OrganizerActivationKit from '@/components/event/OrganizerActivationKit';
import OrganizerEmbedWidget from '@/components/event/OrganizerEmbedWidget';
import { useEventScorecard } from '@/hooks/useEventScorecard';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import OrganizerProgramManager from '@/components/event/OrganizerProgramManager';
import OrganizerFeedManager from '@/components/event/OrganizerFeedManager';
import type { Event } from '@/types/event';

const OrganizerSalonPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'salon' | 'programme' | 'exposants' | 'activation' | 'widget'>('salon');
  const queryClient = useQueryClient();
  const [exhibitorOverride, setExhibitorOverride] = useState<boolean | null>(null);
  const [savingExhibitorVisibility, setSavingExhibitorVisibility] = useState(false);

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
    if (authLoading || loading || adminLoading) return;
    if (!event) return;
    const canManage = !!user && (isAdmin || user.id === event.owner_user_id);
    if (!canManage) {
      navigate(`/events/${event?.slug || slug}`, { replace: true });
    }
  }, [authLoading, loading, adminLoading, user, isAdmin, event, slug, navigate]);

  // Visibilité des sections exposants/nouveautés : décision immédiate, hors
  // circuit de validation admin (RPC dédiée, lot 2). Repli à true : seul un
  // false explicite masque les sections.
  const hasExhibitors = exhibitorOverride ?? (event?.has_exhibitors !== false);

  const handleExhibitorVisibilityChange = async (value: boolean) => {
    if (!event || savingExhibitorVisibility) return;
    const previous = hasExhibitors;
    setExhibitorOverride(value); // optimistic
    setSavingExhibitorVisibility(true);
    try {
      const { error } = await supabase.rpc('set_event_exhibitor_visibility', {
        p_event_id: event.id,
        p_enabled: value,
      });
      if (error) throw error;
      setEvent((prev) => (prev ? { ...prev, has_exhibitors: value } : prev));
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-scorecard', event.id] });
      toast.success(
        value
          ? 'Sections Nouveautés et Exposants réactivées sur votre page publique.'
          : 'Sections Nouveautés et Exposants masquées de votre page publique.',
      );
    } catch (err) {
      console.error('Erreur set_event_exhibitor_visibility:', err);
      setExhibitorOverride(previous); // rollback
      toast.error("La modification n'a pas pu être appliquée. Réessayez.");
    } finally {
      setSavingExhibitorVisibility(false);
    }
  };

  const { data: scorecardData } = useEventScorecard(event?.id, !!event);
  const c = (scorecardData as any)?.completude;
  const exposants = c?.exposants_references ?? 0;
  const pct = Math.max(0, Math.min(100, Number(c?.pct_enrichies ?? 0)));

  if (loading || authLoading || adminLoading) {
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
  if (!user || (!isAdmin && user.id !== event.owner_user_id)) return null;

  type SectionKey = 'salon' | 'programme' | 'exposants' | 'activation' | 'widget';
  const sections: {
    key: SectionKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }[] = [
    {
      key: 'salon',
      label: 'Mon salon',
      icon: Building2,
      title: 'Votre salon',
      description: 'Modifiez les informations principales. Vos changements seront soumis pour validation.',
    },
    {
      key: 'fil',
      label: 'Le Fil',
      icon: Radio,
      title: 'Le Fil du salon',
      description:
        'Publiez une actualité courte, affichée en haut de votre page salon. Une phrase suffit.',
    },
    {
      key: 'programme',
      label: 'Programme',
      icon: CalendarClock,
      title: 'Programme',
      description:
        'Créez et organisez les sessions de votre événement. Chaque session peut être publiée ou gardée en brouillon.',
    },
    {
      key: 'exposants',
      label: 'Mes exposants',
      icon: Users,
      title: 'Vos exposants',
      description: 'Suivez la complétude des fiches et la visibilité de votre salon dans les recherches IA.',
    },
    {
      key: 'activation',
      label: 'Activer mes exposants',
      icon: Megaphone,
      title: 'Activer vos exposants',
      description: 'Invitez vos exposants à compléter leur fiche et à publier leurs nouveautés.',
    },
    {
      key: 'widget',
      label: 'Widget nouveautés',
      icon: Code,
      title: 'Widget nouveautés pour votre site',
      description:
        'Affichez les nouveautés de votre salon sur votre propre site. Copiez ce code et collez-le où vous le souhaitez.',
    },
  ];

  const active = sections.find((s) => s.key === activeSection)!;

  return (
    <MainLayout title={`Gérer ${event.nom_event}`}>
      <div className="max-w-6xl mx-auto py-8 space-y-8">
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

        {/* Mise en page à deux colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6 md:gap-8">
          {/* Nav latérale (desktop) / horizontale (mobile) */}
          <nav
            aria-label="Sections espace organisateur"
            className="md:sticky md:top-20 md:self-start"
          >
            <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0">
              {sections.map((s) => {
                const Icon = s.icon;
                const isActive = s.key === activeSection;
                return (
                  <li key={s.key} className="shrink-0 md:shrink">
                    <button
                      type="button"
                      onClick={() => setActiveSection(s.key)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap md:whitespace-normal text-left',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Contenu de la section active */}
          <section className="min-w-0">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-foreground">{active.title}</h2>
              <p className="text-sm text-muted-foreground">{active.description}</p>
            </div>
            {activeSection === 'salon' && (
              <>
                <Card className="p-6">
                  <OrganizerEventEditForm event={event} />
                </Card>

                {/* Visibilité exposants : appliquée immédiatement, sans validation. */}
                <Card className="p-6 mt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-foreground">
                        Cet événement accueille des exposants
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Décochez si votre événement ne mobilise pas d'exposants (congrès, conférence).
                        Les sections Nouveautés et Exposants seront masquées de votre page publique.
                        Vous pouvez réactiver à tout moment.
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        Cette modification est appliquée immédiatement, sans validation.
                      </p>
                    </div>
                    <Switch
                      checked={hasExhibitors}
                      onCheckedChange={handleExhibitorVisibilityChange}
                      disabled={savingExhibitorVisibility}
                      aria-label="Cet événement accueille des exposants"
                      className="shrink-0"
                    />
                  </div>
                </Card>
              </>
            )}
            {activeSection === 'fil' && (
              <OrganizerFeedManager eventId={event.id} eventDateFin={event.date_fin} />
            )}
            {activeSection === 'programme' && <OrganizerProgramManager eventId={event.id} />}
            {activeSection === 'exposants' && <SeoScorecard eventId={event.id} />}
            {activeSection === 'activation' && (
              <OrganizerActivationKit
                event={{ id: event.id, slug: event.slug, nom_event: event.nom_event }}
              />
            )}
            {activeSection === 'widget' && (
              <OrganizerEmbedWidget slug={event.slug || event.id} nomEvent={event.nom_event} />
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default OrganizerSalonPage;