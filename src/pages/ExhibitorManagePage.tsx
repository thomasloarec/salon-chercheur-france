import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Award, Building2, CalendarDays, ExternalLink, LifeBuoy, Sparkles, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useExhibitorProfile } from '@/hooks/useExhibitorProfile';
import { useExhibitorGovernance } from '@/hooks/useExhibitorGovernance';
import { useExhibitorCompletion, type ExhibitorTier } from '@/hooks/useExhibitorCompletion';
import { canEditExhibitorProfile } from '@/lib/exhibitorOwnerEdit';
import { cleanAiDescription } from '@/lib/exhibitorDescription';

import ExhibitorFicheSection from '@/components/exhibitor/manage/ExhibitorFicheSection';
import ExhibitorSalonsSection from '@/components/exhibitor/manage/ExhibitorSalonsSection';
import ExhibitorNoveltiesSection from '@/components/exhibitor/manage/ExhibitorNoveltiesSection';
import ExhibitorTeamSection from '@/components/exhibitor/manage/ExhibitorTeamSection';
import SupportChatPanel from '@/components/support/SupportChatPanel';
import { useSupportUnread } from '@/components/support/useSupportUnread';

const TIER_LABEL: Record<ExhibitorTier, string> = {
  bronze: 'Bronze',
  argent: 'Argent',
  or: 'Or',
};

type SectionKey = 'fiche' | 'salons' | 'nouveautes' | 'equipe' | 'aide';

const SECTIONS: {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}[] = [
  {
    key: 'fiche',
    label: 'Ma fiche',
    icon: Building2,
    title: 'Votre fiche entreprise',
    description:
      'Ces informations sont affichées publiquement sur votre fiche exposant. Les modifications sont visibles immédiatement.',
  },
  {
    key: 'salons',
    label: 'Mes salons',
    icon: CalendarDays,
    title: 'Vos salons',
    description:
      'Renseignez vos numéros de stand et déclarez vos participations aux salons à venir.',
  },
  {
    key: 'nouveautes',
    label: 'Mes nouveautés',
    icon: Sparkles,
    title: 'Vos nouveautés',
    description:
      'Suivez vos nouveautés telles qu\u2019elles apparaissent sur le site, avec les leads générés.',
  },
  {
    key: 'equipe',
    label: 'Mon équipe',
    icon: Users,
    title: 'Votre équipe',
    description: 'Indiquez qui gère cette page et invitez vos collaborateurs.',
  },
  {
    key: 'aide',
    label: "Besoin d'aide",
    icon: LifeBuoy,
    title: "Besoin d'aide ?",
    description: 'Écrivez-nous depuis cet espace. Nous vous répondons ici et par email.',
  },
];

export default function ExhibitorManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isRealUser, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { data: profile, isLoading, isError } = useExhibitorProfile(slug);
  const [activeSection, setActiveSection] = useState<SectionKey>('fiche');

  // Promotion à l'accès (parité avec l'espace organisateur des salons) :
  // un admin peut gérer n'importe quel exposant, y compris les fiches legacy
  // (exhibitor_id NULL). À l'ouverture, la fiche legacy est matérialisée en
  // fiche moderne côté serveur (RPC admin, slug public préservé), puis la page
  // se recharge normalement.
  const [materializing, setMaterializing] = useState(false);
  const [materializeFailed, setMaterializeFailed] = useState(false);

  const governance = useExhibitorGovernance(
    profile?.exhibitor_id || profile?.legacy_exposant_id || undefined,
    profile?.display_name || profile?.canonical_name || undefined,
  );

  const exhibitorId = profile?.exhibitor_id ?? undefined;
  const { data: completionMap, isLoading: completionLoading } = useExhibitorCompletion(
    exhibitorId ? [exhibitorId] : [],
  );
  const completion = exhibitorId ? completionMap?.[exhibitorId] : undefined;

  const isManagerOfProfile = canEditExhibitorProfile({
    isAuthenticated: isRealUser,
    exhibitorId: profile?.exhibitor_id,
    isTest: profile?.is_test,
    isManager: governance.isManager,
  });
  // Un admin peut toujours gérer (comme sur la page organisateur du salon).
  const canManage = isManagerOfProfile || isAdmin;
  // Fiche legacy ouverte par un admin : à matérialiser avant l'affichage.
  const needsMaterialization =
    isAdmin && !isManagerOfProfile && !!profile && !profile.exhibitor_id && !isError;

  const ready = !authLoading && !adminLoading && !isLoading && !governance.isLoading;

  // Redirection des utilisateurs non habilités (comportement inchangé).
  useEffect(() => {
    if (!ready) return;
    if (isError || !profile || !canManage) {
      navigate(`/exposants/${slug ?? ''}`, { replace: true });
    }
  }, [ready, isError, profile, canManage, navigate, slug]);

  // Matérialisation admin d'une fiche legacy -> fiche moderne (slug préservé).
  useEffect(() => {
    if (!ready || !needsMaterialization) return;
    if (materializing || materializeFailed) return;
    let cancelled = false;
    setMaterializing(true);
    // Cast: le RPC vient d'être ajouté et n'est pas encore dans les types générés.
    // Promise.resolve: rpc() renvoie un PromiseLike sans .finally dans les types.
    Promise.resolve(
      supabase.rpc('admin_materialize_exhibitor_from_slug' as never, { p_public_slug: slug } as never),
    )
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          console.error('admin_materialize_exhibitor_from_slug:', error);
          setMaterializeFailed(true);
          toast.error("Impossible d'ouvrir la gestion de cet exposant.");
          navigate(`/exposants/${slug ?? ''}`, { replace: true });
        } else {
          queryClient.invalidateQueries({ queryKey: ['public-exhibitor-profile', slug] });
        }
      })
      .finally(() => {
        if (!cancelled) setMaterializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    needsMaterialization,
    materializing,
    materializeFailed,
    slug,
    navigate,
    queryClient,
  ]);

  if (!ready || materializing || (needsMaterialization && !materializeFailed)) {
    return (
      <MainLayout title="Gérer ma fiche exposant">
        <div className="max-w-6xl mx-auto py-8 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!profile || !canManage || !profile.exhibitor_id) return null;

  const name = profile.display_name || profile.canonical_name || 'Exposant';
  const publicSlug = profile.public_slug;
  const active = SECTIONS.find((s) => s.key === activeSection)!;

  return (
    <MainLayout title={`Gérer ${name}`}>
      <div className="max-w-6xl mx-auto py-8 space-y-8">
        {/* En-tête */}
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Espace exposant
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{name}</h1>
            </div>
            {publicSlug && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/exposants/${publicSlug}`}>
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Voir la page publique
                </Link>
              </Button>
            )}
          </div>
          {completion && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Award className="h-3 w-3" />
                Fiche complétée à {completion.profile_score}%
                {completion.tier ? ` · palier ${TIER_LABEL[completion.tier]}` : ''}
              </Badge>
            </div>
          )}
        </header>

        {/* Mise en page à deux colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6 md:gap-8">
          <nav aria-label="Sections espace exposant" className="md:sticky md:top-20 md:self-start">
            <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0">
              {SECTIONS.map((s) => {
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
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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

          <section className="min-w-0">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-foreground">{active.title}</h2>
              <p className="text-sm text-muted-foreground">{active.description}</p>
            </div>

            {activeSection === 'fiche' && (
              <ExhibitorFicheSection
                exhibitorId={profile.exhibitor_id}
                publicSlug={publicSlug}
                exhibitorName={name}
                resolvedDescription={cleanAiDescription(profile.description)}
                completion={completion}
                completionLoading={completionLoading}
                onGoToTeam={() => setActiveSection('equipe')}
              />
            )}

            {activeSection === 'salons' && (
              <ExhibitorSalonsSection exhibitorId={profile.exhibitor_id} />
            )}

            {activeSection === 'nouveautes' && (
              <ExhibitorNoveltiesSection
                exhibitorId={profile.exhibitor_id}
                exhibitorName={name}
                exhibitorLogoUrl={profile.logo_url}
                exhibitorPublicSlug={publicSlug}
                hasUpcomingParticipation={
                  completion?.has_upcoming_participation ??
                  (profile.future_participations_count ?? 0) > 0
                }
                onGoToSalons={() => setActiveSection('salons')}
              />
            )}

            {activeSection === 'equipe' && (
              <ExhibitorTeamSection
                exhibitorId={profile.exhibitor_id}
                publicSlug={publicSlug}
                isOwner={governance.isOwner || isAdmin}
                completion={completion}
              />
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
