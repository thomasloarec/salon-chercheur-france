import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  Lock,
  Plus,
  Rocket,
  User,
  Users,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useExhibitorGovernance } from '@/hooks/useExhibitorGovernance';
import { useExhibitorCompletion, ExhibitorTier } from '@/hooks/useExhibitorCompletion';
import { canEditExhibitorProfile } from '@/lib/exhibitorOwnerEdit';
import { cleanAiDescription } from '@/lib/exhibitorDescription';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import ExhibitorOwnerEditDrawer from '@/components/exhibitor/ExhibitorOwnerEditDrawer';

const TIER_META: Record<ExhibitorTier, { label: string; className: string }> = {
  bronze: { label: 'Bronze', className: 'border-amber-700/30 bg-amber-700/10 text-amber-800' },
  argent: { label: 'Argent', className: 'border-slate-400/40 bg-slate-200/60 text-slate-700' },
  or: { label: 'Or', className: 'border-accent/40 bg-accent/10 text-accent' },
};

/**
 * Bloc B — Espace gestionnaire affiché EN HAUT de /exposants/{slug}.
 *
 * Visibilité : strictement les gestionnaires actifs de CETTE fiche
 * (réutilise canEditExhibitorProfile, le même prédicat que « Modifier cette
 * fiche »). Invisible pour les visiteurs et les gestionnaires d'autres fiches.
 *
 * Affichage intelligent : visible s'il y a quelque chose à faire
 *   (profile_score < 100) OU (salon à venir SANS Nouveauté publiée).
 * Masqué automatiquement quand profil = 100 % ET (pas de salon à venir OU
 * Nouveauté déjà publiée). L'état étant recalculé depuis la vue à chaque
 * chargement, une nouvelle participation sans Nouveauté le fait réapparaître.
 *
 * Le score/palier sont PRIVÉS au widget — jamais affichés dans l'en-tête public.
 */
export default function ExhibitorManagerWidget({
  profile,
}: {
  profile: PublicExhibitorProfile;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [collapsed, setCollapsed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [govChoiceOpen, setGovChoiceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const governance = useExhibitorGovernance(
    profile.exhibitor_id || profile.legacy_exposant_id || undefined,
    profile.display_name || profile.canonical_name || undefined,
  );

  const canManage = canEditExhibitorProfile({
    isAuthenticated: !!user,
    exhibitorId: profile.exhibitor_id,
    isTest: profile.is_test,
    isManager: governance.isManager,
  });

  const exhibitorId = profile.exhibitor_id ?? undefined;
  const { data: completionMap, isLoading } = useExhibitorCompletion(
    exhibitorId ? [exhibitorId] : [],
  );
  const completion = exhibitorId ? completionMap?.[exhibitorId] : undefined;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['exhibitor-completion'] });
    queryClient.invalidateQueries({ queryKey: ['exhibitor-governance'] });
    if (profile.public_slug) {
      queryClient.invalidateQueries({
        queryKey: ['public-exhibitor-profile', profile.public_slug],
      });
    }
  };

  const soloMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('exhibitors')
        .update({ governance_state: 'solo' })
        .eq('id', exhibitorId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Gouvernance confirmée',
        description: 'Vous gérez cette page. Vous pourrez inviter des collaborateurs à tout moment.',
      });
      setGovChoiceOpen(false);
      invalidate();
    },
    onError: () => toast({ title: 'Erreur lors de la confirmation', variant: 'destructive' }),
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'owner_add_member', exhibitor_id: exhibitorId, user_email: email },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.status === 'invited') {
        toast({ title: `Invitation envoyée à ${data.email}`, description: "Un email d'invitation a été envoyé." });
      } else {
        toast({ title: 'Collaborateur ajouté' });
      }
      setInviteEmail('');
      setInviteOpen(false);
      setGovChoiceOpen(false);
      // Invitation effective → page gérée à plusieurs.
      await supabase
        .from('exhibitors')
        .update({ governance_state: 'team' })
        .eq('id', exhibitorId as string);
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: err?.message || "Erreur lors de l'ajout", variant: 'destructive' }),
  });

  // ── Gardes de visibilité ────────────────────────────────────────────────
  if (governance.isLoading || isLoading) {
    if (!canManage && !governance.isLoading) return null;
    return canManage ? (
      <div className="border-t-[3px] border-t-accent rounded-lg border bg-card p-4 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-2 w-full" />
      </div>
    ) : null;
  }

  if (!canManage || !completion) return null;

  const score = completion.profile_score;
  const tier = completion.tier;
  const needsNovelty =
    completion.has_upcoming_participation && !completion.has_upcoming_novelty;

  // Affichage intelligent : rien à faire → on ne rend rien.
  if (score >= 100 && !needsNovelty) return null;

  const isOwner = governance.isOwner;
  const editLink = profile.public_slug ? `/exposants/${profile.public_slug}` : null;

  const items = [
    { key: 'description', label: 'Description (120 caractères min.)', points: 25, icon: FileText, done: completion.has_description, highValue: true },
    { key: 'logo', label: 'Logo', points: 20, icon: ImageIcon, done: completion.has_logo, highValue: false },
    { key: 'website', label: 'Site officiel', points: 15, icon: Globe, done: completion.has_website, highValue: false },
    { key: 'linkedin', label: 'Page LinkedIn', points: 15, icon: Linkedin, done: completion.has_linkedin, highValue: true },
    { key: 'governance', label: 'Gouvernance de la page', points: 25, icon: Users, done: completion.governance_confirmed, highValue: true },
  ] as const;

  const missingHighValue = items.filter((i) => !i.done && i.highValue).length;

  return (
    <div className="border-t-[3px] border-t-accent rounded-lg border bg-card overflow-hidden shadow-sm">
      {/* En-tête : jauge + palier (privés au widget) */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-primary">Espace gestionnaire</span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {score}/100
            </span>
            {tier && (
              <Badge variant="outline" className={`gap-1 ${TIER_META[tier].className}`}>
                <Award className="h-3 w-3" />
                {TIER_META[tier].label}
              </Badge>
            )}
            {completion.governance_state === 'team' && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                Équipe
              </Badge>
            )}
          </div>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <Progress value={score} className="h-2" />
        {collapsed && missingHighValue > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {missingHighValue} action{missingHighValue > 1 ? 's' : ''} à fort impact pour activer votre fiche.
          </p>
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-1.5 border-t pt-3">
          {items.map((item) => {
            const Icon = item.icon;

            if (item.done) {
              return (
                <div key={item.key} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            }

            if (item.key === 'governance') {
              if (!isOwner) {
                return (
                  <div key={item.key} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Gouvernance à confirmer par le propriétaire</span>
                  </div>
                );
              }
              return (
                <div key={item.key} className="rounded-md border border-accent/30 bg-accent/5 p-2.5">
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Confirmez la gouvernance de cette page</p>
                      <p className="text-xs text-muted-foreground">
                        Indiquez si vous gérez cette page seul(e) ou à plusieurs. Réversible à tout moment.
                      </p>
                      {!govChoiceOpen ? (
                        <Button size="sm" variant="outline" className="mt-2 h-7" onClick={() => setGovChoiceOpen(true)}>
                          Configurer
                        </Button>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-col gap-2">
                            <Button size="sm" className="h-8" onClick={() => soloMutation.mutate()} disabled={soloMutation.isPending}>
                              {soloMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <User className="h-3.5 w-3.5 mr-1" />
                              )}
                              Je gère seul(e)
                            </Button>
                            <Button size="sm" variant="secondary" className="h-8 w-full sm:w-auto" onClick={() => setInviteOpen((v) => !v)}>
                              <Users className="h-3.5 w-3.5 mr-1" />
                              Inviter un collaborateur
                            </Button>
                          </div>
                          {inviteOpen && (
                            <div className="flex gap-2">
                              <Input
                                placeholder="email@exemple.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="flex-1 h-8 text-sm"
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => inviteMutation.mutate(inviteEmail)}
                                disabled={!inviteEmail || inviteMutation.isPending}
                              >
                                {inviteMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                )}
                                Inviter
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Items éditoriaux manquants (description / linkedin / logo / site) :
            // tous ouvrent le drawer d'édition (pré-rempli, cf. Bloc C).
            const highlight = item.highValue;
            return (
              <div
                key={item.key}
                className={
                  highlight
                    ? 'flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 p-2.5'
                    : 'flex items-center justify-between gap-2 py-1'
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${highlight ? 'text-accent' : 'text-muted-foreground'}`} />
                  <span className={`text-sm truncate ${highlight ? 'font-medium' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={highlight ? 'default' : 'ghost'}
                  className="h-7 flex-shrink-0"
                  onClick={() => setEditOpen(true)}
                >
                  Ajouter
                </Button>
              </div>
            );
          })}

          {/* Nudge Nouveauté (objectif Or) */}
          {needsNovelty && (
            <div className="rounded-md border border-accent/40 bg-accent/10 p-3 mt-2">
              <div className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">Vous participez à un salon à venir</p>
                  <p className="text-xs text-muted-foreground">
                    Publiez une Nouveauté pour générer des leads avant l'événement.
                  </p>
                  <Button asChild size="sm" className="mt-2 h-7 w-full sm:w-auto">
                    <Link to="/publier-nouveaute">Publier une Nouveauté</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ExhibitorOwnerEditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        exhibitorId={exhibitorId as string}
        publicSlug={profile.public_slug}
        exhibitorName={profile.display_name || profile.canonical_name || 'Exposant'}
        resolvedDescription={cleanAiDescription(profile.description)}
      />
    </div>
  );
}
