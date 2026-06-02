import { useState, useRef } from 'react';
import { Building2, ChevronDown, ChevronUp, Plus, Trash2, Crown, Users, User, ExternalLink, Info, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import VerifiedBadge from '@/components/exhibitor/VerifiedBadge';
import { useMyExhibitors, MyExhibitorMembership } from '@/hooks/useMyExhibitors';
import { fetchExhibitorPublicSlugs, resolvePublicSlug, PublicSlugInfo } from '@/lib/exhibitorPublicSlug';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  email: string | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    job_title: string | null;
    company: string | null;
  } | null;
}

const ExhibitorPanel = ({
  membership,
  slugInfo,
}: {
  membership: MyExhibitorMembership;
  slugInfo?: PublicSlugInfo;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addEmail, setAddEmail] = useState('');

  const isOwner = membership.role === 'owner';
  const ex = membership.exhibitor;
  const logoUrl = getExhibitorLogoUrl(ex.logo_url, undefined);
  const teamSectionRef = useRef<HTMLDivElement>(null);

  // Public profile link: only when a non-test public slug exists.
  const publicSlug = slugInfo && !slugInfo.is_test ? slugInfo.public_slug : null;

  const handleToggleTeam = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && teamSectionRef.current) {
      setTimeout(() => {
        teamSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  // Fetch team members when expanded
  const { data: teamMembers = [], isLoading: teamLoading, refetch: refetchTeam } = useQuery<TeamMember[]>({
    queryKey: ['exhibitor-team', ex.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'owner_get_team', exhibitor_id: ex.id },
      });
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: expanded,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-exhibitors'] });
    queryClient.invalidateQueries({ queryKey: ['exhibitor-team', ex.id] });
  };

  // Add team member (owner only)
  const addMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'owner_add_member', exhibitor_id: ex.id, user_email: email },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.status === 'invited') {
        toast({ title: `Invitation envoyée à ${data.email}`, description: 'Un email d\'invitation a été envoyé.' });
      } else {
        toast({ title: 'Collaborateur ajouté' });
      }
      setAddEmail('');
      refetchTeam();
    },
    onError: (err: any) => {
      const msg = err?.message || 'Erreur lors de l\'ajout';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  // Remove team member (owner only)
  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'owner_remove_member', exhibitor_id: ex.id, membership_id: membershipId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Collaborateur retiré' });
      refetchTeam();
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Propriétaire';
      case 'admin': return 'Collaborateur';
      default: return role;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header row - always visible */}
      <button
        className="flex items-center gap-3 p-3 w-full hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {logoUrl ? (
          <div className="h-10 w-10 rounded bg-background border flex items-center justify-center flex-shrink-0 p-1">
            <img src={logoUrl} alt={ex.name} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{ex.name}</span>
            {ex.verified_at && <VerifiedBadge />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs">{roleLabel(membership.role)}</Badge>
          </div>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Public profile access — always visible, primary action */}
      <div className="px-3 pb-3 pt-0">
        {publicSlug ? (
          <Button asChild className="w-full" size="sm">
            <Link to={`/exposants/${publicSlug}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Voir / modifier la fiche publique
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full" disabled>
            Fiche publique en préparation
          </Button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          {/* Public content edition moved to the public profile page */}
          <div className="flex gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Pour modifier les informations publiques de cette entreprise
              (description, logo, site web, LinkedIn), accédez à sa fiche
              publique puis utilisez le bouton « Modifier cette fiche ».
            </p>
          </div>

          <Separator />

          {/* Team members */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Équipe de gestion</span>
            </div>

            {teamLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {teamMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {m.role === 'owner' ? <Crown className="h-3 w-3 text-amber-600" /> : <User className="h-3 w-3" />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {m.profile?.first_name} {m.profile?.last_name}
                          <Badge variant="outline" className="text-[10px] py-0">
                            {roleLabel(m.role)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                    {/* Only owner can remove admin members */}
                    {isOwner && m.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 w-7 p-0"
                        onClick={() => removeMemberMutation.mutate(m.id)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add member form - owner only */}
            {isOwner && (
              <>
                <Separator className="my-3" />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Ajouter un collaborateur par email</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="email@exemple.com"
                      value={addEmail}
                      onChange={e => setAddEmail(e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => addMemberMutation.mutate(addEmail)}
                      disabled={!addEmail || addMemberMutation.isPending}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                </div>
              </>
            )}

            {!isOwner && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Seul le propriétaire peut ajouter ou retirer des collaborateurs.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MyExhibitorsSection = () => {
  const { data: memberships, isLoading } = useMyExhibitors();

  // Batch resolve public slugs in ONE query for all managed exhibitors,
  // from the reliable public source (public_exhibitor_profiles).
  const exhibitorIds = (memberships ?? []).map((m) => m.exhibitor_id);
  const { data: slugMaps } = useQuery({
    queryKey: ['my-exhibitors-public-slugs', exhibitorIds],
    queryFn: () => fetchExhibitorPublicSlugs(exhibitorIds, []),
    enabled: exhibitorIds.length > 0,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Entreprises que je gère</h2>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!memberships || memberships.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        Entreprises que je gère
      </h2>
      <div className="space-y-3">
        {memberships.map((m) => (
          <ExhibitorPanel
            key={m.id}
            membership={m}
            slugInfo={resolvePublicSlug(slugMaps, { exhibitorId: m.exhibitor_id })}
          />
        ))}
      </div>
    </Card>
  );
};

export default MyExhibitorsSection;
