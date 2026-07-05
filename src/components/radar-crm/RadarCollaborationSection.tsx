import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, UserPlus, Mail, Building2, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Radar CRM — section "Collaboration" (comptes partagés multi-membres).
 * FRONTEND UNIQUEMENT : consomme les RPC/Edge Function déjà déployés.
 * Rendu depuis l'état persisté : après chaque mutation, on refetch (jamais depuis
 * la réponse d'invoke).
 */

type Member = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_me: boolean;
  last_seen_at: string | null;
};

type Team = {
  account_id: string;
  my_role: 'owner' | 'member' | string;
  active_member_count: number;
  org_name: string | null;
  members: Member[];
};

type PendingInvitation = {
  invitation_id: string;
  email: string;
  role: string;
  invited_at: string;
  expires_at: string;
};

type Space = {
  account_id: string;
  name: string;
  org_name: string | null;
  role: string;
  is_active: boolean;
  member_count: number;
};

const initialsFrom = (name: string): string => {
  const words = name.split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const displayNameOf = (m: Member): string => {
  const raw = (m.display_name ?? '').trim();
  if (!raw) return 'Membre';
  if (raw.includes('@') && !raw.includes(' ')) {
    const local = raw.split('@')[0]?.trim();
    return local && local.length > 0 ? local : 'Membre';
  }
  return raw;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const INVITE_ERROR_LABELS: Record<string, string> = {
  already_member: 'Cette personne est déjà membre de votre espace.',
  seats_limit_reached: "Limite de sièges atteinte pour votre espace.",
  invalid_email: "Adresse email invalide.",
  forbidden: "Vous n'êtes pas autorisé à inviter des membres.",
  email_send_failed: "L'invitation a été créée mais l'email n'a pas pu être envoyé.",
};

const RadarCollaborationSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [savingOrgName, setSavingOrgName] = useState(false);

  const isOwner = team?.my_role === 'owner';

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([
      supabase.rpc('get_my_radar_team'),
      supabase.rpc('list_my_radar_spaces'),
    ]);
    const teamRow = (t.data ?? null) as unknown as Team | null;
    setTeam(teamRow);
    setOrgNameInput((teamRow?.org_name ?? '').trim());
    setSpaces((s.data ?? []) as unknown as Space[]);

    // Invitations en attente : réservées à l'owner.
    if (teamRow?.my_role === 'owner') {
      const inv = await supabase.rpc('list_my_radar_pending_invitations');
      setInvitations((inv.data ?? []) as unknown as PendingInvitation[]);
    } else {
      setInvitations([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !team) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke('radar-send-invitation', {
      body: { account_id: team.account_id, email },
    });
    setInviting(false);

    // supabase.functions.invoke renvoie une erreur pour les statuts non-2xx :
    // on tente de lire le code applicatif dans data si présent, sinon on mappe l'erreur.
    const payload = (data ?? null) as { ok?: boolean; error?: string; email?: string } | null;
    if (error || !payload?.ok) {
      const code = payload?.error ?? '';
      const message = INVITE_ERROR_LABELS[code] ?? "L'invitation n'a pas pu être envoyée.";
      toast({ title: 'Invitation impossible', description: message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invitation envoyée', description: `Invitation envoyée à ${payload.email ?? email}` });
    setInviteEmail('');
    await load();
  };

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    const { error } = await supabase.rpc('revoke_radar_invitation', { p_invitation_id: invitationId });
    setRevokingId(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invitation annulée' });
    await load();
  };

  const handleRemove = async () => {
    if (!memberToRemove || !team) return;
    setRemoving(true);
    const { error } = await supabase.rpc('remove_radar_member', {
      p_account_id: team.account_id,
      p_user_id: memberToRemove.user_id,
    });
    setRemoving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Membre retiré' });
    setMemberToRemove(null);
    await load();
  };

  const handleSwitchSpace = async (accountId: string) => {
    setSwitchingId(accountId);
    const { error } = await supabase.rpc('set_active_radar_space', { p_account_id: accountId });
    if (error) {
      setSwitchingId(null);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    // L'espace actif détermine TOUTES les données Radar CRM : on recharge la vue entière.
    toast({ title: 'Espace activé', description: 'Rechargement de votre Radar CRM…' });
    window.location.reload();
  };

  const handleSaveOrgName = async () => {
    if (!team) return;
    const name = orgNameInput.trim();
    if (!name || name === (team.org_name ?? '').trim()) return;
    setSavingOrgName(true);
    const { error } = await supabase.rpc('set_radar_space_name', {
      p_account_id: team.account_id,
      p_name: name,
    });
    setSavingOrgName(false);
    if (error) {
      const message = /forbidden/i.test(error.message)
        ? "Seul le propriétaire peut renommer l'espace."
        : error.message;
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Nom de l\'entreprise enregistré' });
    // Rendu depuis l'état persisté : on refetch (jamais depuis la réponse d'invoke).
    await load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!team) return null;

  const isSolo = team.active_member_count <= 1;
  const hasMultipleSpaces = spaces.length > 1;

  return (
    <>
      {/* Nom de l'entreprise / espace */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Nom de l'entreprise</h3>
          </div>
          {isOwner ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ce nom identifie votre espace Radar CRM auprès de votre équipe.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Label htmlFor="org-name" className="sr-only">Nom de l'entreprise</Label>
                  <Input
                    id="org-name"
                    value={orgNameInput}
                    onChange={(e) => setOrgNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveOrgName(); } }}
                    placeholder="Ex : Standex Electronics"
                    disabled={savingOrgName}
                  />
                </div>
                <Button
                  onClick={() => void handleSaveOrgName()}
                  disabled={savingOrgName || !orgNameInput.trim() || orgNameInput.trim() === (team.org_name ?? '').trim()}
                >
                  {savingOrgName ? (<><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enregistrement…</>) : 'Enregistrer'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm font-medium">
              {team.org_name?.trim() || <span className="text-muted-foreground font-normal">Espace non nommé</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sélecteur d'espace — uniquement si > 1 espace */}
      {hasMultipleSpaces && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Espace de travail</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous appartenez à plusieurs espaces Radar CRM. L'espace actif détermine les données affichées.
            </p>
            <div className="space-y-2">
              {spaces.map((sp) => (
                <div
                  key={sp.account_id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-sm">{sp.org_name?.trim() || sp.name}</span>
                      {sp.is_active && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary shrink-0">
                          <Check className="mr-1 h-3 w-3" /> Actif
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sp.member_count} membre{sp.member_count > 1 ? 's' : ''}
                    </p>
                  </div>
                  {!sp.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={switchingId !== null}
                      onClick={() => void handleSwitchSpace(sp.account_id)}
                    >
                      {switchingId === sp.account_id ? (
                        <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Activation…</>
                      ) : (
                        'Basculer'
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Membres */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Membres de l'espace</h3>
          </div>

          <div className="space-y-2">
            {team.members.map((m) => {
              const name = displayNameOf(m);
              const memberIsOwner = m.role === 'owner';
              const canRemove = isOwner && !m.is_me && !memberIsOwner;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-primary"
                    >
                      {initialsFrom(name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate font-medium text-sm">{name}</span>
                        {m.is_me && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Vous</Badge>
                        )}
                      </div>
                      {m.email && (
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      )}
                      <Badge
                        variant="secondary"
                        className={
                          memberIsOwner
                            ? 'mt-1 bg-primary/10 text-primary hover:bg-primary/10'
                            : 'mt-1'
                        }
                      >
                        {memberIsOwner ? 'Super admin' : 'Membre'}
                      </Badge>
                    </div>
                  </div>
                  {canRemove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => setMemberToRemove(m)}
                    >
                      Retirer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Inviter — owner uniquement */}
      {isOwner && (
        <Card className={isSolo ? 'border-primary/40 bg-secondary/40' : undefined}>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Inviter un collègue</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {isSolo
                ? 'Invitez vos collègues pour préparer et organiser vos visites salon ensemble.'
                : "Ajoutez un membre à votre espace : il pourra préparer et suivre les visites avec vous."}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">Email du collègue</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleInvite(); } }}
                  placeholder="collegue@entreprise.com"
                  disabled={inviting}
                />
              </div>
              <Button onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Envoi…</>
                ) : (
                  'Inviter'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invitations en attente — owner uniquement */}
      {isOwner && invitations.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Invitations en attente</h3>
            </div>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.invitation_id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <span className="truncate block font-medium text-sm">{inv.email}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Expire le {formatDate(inv.expires_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    disabled={revokingId !== null}
                    onClick={() => void handleRevoke(inv.invitation_id)}
                  >
                    {revokingId === inv.invitation_id ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> …</>
                    ) : (
                      'Annuler'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={memberToRemove !== null} onOpenChange={(o) => { if (!o) setMemberToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove
                ? `${displayNameOf(memberToRemove)} n'aura plus accès à cet espace Radar CRM. Cette action peut être annulée en le réinvitant.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => { e.preventDefault(); void handleRemove(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Retrait…' : 'Retirer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RadarCollaborationSection;