import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, User, Users } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExhibitorCompletion } from '@/hooks/useExhibitorCompletion';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  email: string | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface ExhibitorTeamSectionProps {
  exhibitorId: string;
  publicSlug: string | null;
  isOwner: boolean;
  completion?: ExhibitorCompletion;
}

export default function ExhibitorTeamSection({
  exhibitorId,
  publicSlug,
  isOwner,
  completion,
}: ExhibitorTeamSectionProps) {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['exhibitor-completion'] });
    queryClient.invalidateQueries({ queryKey: ['exhibitor-governance'] });
    queryClient.invalidateQueries({ queryKey: ['exhibitor-team', exhibitorId] });
    if (publicSlug) {
      queryClient.invalidateQueries({ queryKey: ['public-exhibitor-profile', publicSlug] });
    }
  };

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['exhibitor-team', exhibitorId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'owner_get_team', exhibitor_id: exhibitorId },
      });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    enabled: !!exhibitorId,
    staleTime: 30_000,
  });

  const soloMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('exhibitors')
        .update({ governance_state: 'solo' })
        .eq('id', exhibitorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Gouvernance confirmée', {
        description: 'Vous gérez cette page. Vous pourrez inviter des collaborateurs à tout moment.',
      });
      invalidate();
    },
    onError: () => toast.error('Erreur lors de la confirmation'),
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'owner_add_member', exhibitor_id: exhibitorId, user_email: email },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as { status?: string; email?: string };
    },
    onSuccess: async (data) => {
      if (data?.status === 'invited') {
        toast.success(`Invitation envoyée à ${data.email}`, {
          description: "Un email d'invitation a été envoyé.",
        });
      } else {
        toast.success('Collaborateur ajouté');
      }
      setInviteEmail('');
      setInviteOpen(false);
      await supabase
        .from('exhibitors')
        .update({ governance_state: 'team' })
        .eq('id', exhibitorId);
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error && err.message ? err.message : "Erreur lors de l'ajout"),
  });

  const roleLabel = (role: string) =>
    role === 'owner' ? 'Propriétaire' : role === 'admin' ? 'Administrateur' : role;

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">Gouvernance de la page</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Indiquez si vous gérez cette page seul(e) ou à plusieurs. Ce choix est réversible à
              tout moment.
            </p>
          </div>
          {completion?.governance_state === 'team' ? (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              Équipe
            </Badge>
          ) : completion?.governance_state === 'solo' ? (
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              Gestion seul(e)
            </Badge>
          ) : null}
        </div>

        {!isOwner ? (
          <p className="text-sm text-muted-foreground">
            Seul le propriétaire de la page peut confirmer la gouvernance et inviter des
            collaborateurs.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => soloMutation.mutate()} disabled={soloMutation.isPending}>
                {soloMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                Je gère seul(e)
              </Button>
              <Button variant="secondary" onClick={() => setInviteOpen((v) => !v)}>
                <Users className="h-4 w-4 mr-2" />
                Inviter un collaborateur
              </Button>
            </div>
            {inviteOpen && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <Label htmlFor="team-invite-email">Adresse email du collaborateur</Label>
                <div className="flex gap-2">
                  <Input
                    id="team-invite-email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => inviteMutation.mutate(inviteEmail)}
                    disabled={!inviteEmail || inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Inviter
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold">Membres de l'équipe</h3>
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun collaborateur pour le moment.
          </p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => {
              const fullName = [m.profile?.first_name, m.profile?.last_name]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fullName || m.email || 'Collaborateur'}
                    </p>
                    {fullName && m.email && (
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                    {m.status === 'invited' && <Badge variant="outline">Invité</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
