import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, Building2, Shield, ShieldCheck, Globe, User, Users, Clock,
  Plus, Trash2, Crown, ExternalLink, AlertCircle, CheckCircle, Pencil, Save, X, ClipboardList,
  Briefcase, Mail,
} from 'lucide-react';
import { useAdminExhibitorDetail } from '@/hooks/useAdminExhibitors';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  exhibitorId: string;
  onBack: () => void;
}

const AdminExhibitorDetailPanel = ({ exhibitorId, onBack }: Props) => {
  const { data, isLoading } = useAdminExhibitorDetail(exhibitorId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [addUserId, setAddUserId] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-exhibitor-detail', exhibitorId] });
    queryClient.invalidateQueries({ queryKey: ['admin-exhibitors'] });
    queryClient.invalidateQueries({ queryKey: ['admin-claim-requests'] });
  };

  // Update description
  const updateDescMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'update', exhibitor_id: exhibitorId, description: editDesc },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Description mise à jour' });
      setEditing(false);
      invalidate();
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  // Add team member
  const addMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'admin_add_member', exhibitor_id: exhibitorId, user_email: email, role: 'admin' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.email_sent === false) {
        toast({
          title: data?.status === 'invited' ? 'Invitation créée' : 'Membre ajouté',
          description: "⚠️ L'email de notification n'a pas pu être envoyé. Le membre a bien été ajouté en base.",
        });
      } else {
        toast({
          title: data?.status === 'invited' ? 'Invitation envoyée' : 'Membre ajouté et notifié',
          description: data?.status === 'invited'
            ? `Un email d'invitation a été envoyé à ${data?.email}.`
            : 'Un email de notification a été envoyé au nouveau gestionnaire.',
        });
      }
      setAddUserId('');
      invalidate();
    },
    onError: (err: any) => toast({ title: 'Erreur lors de l\'ajout', description: err?.message || 'Erreur inattendue', variant: 'destructive' }),
  });

  // Remove team member
  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'admin_remove_member', membership_id: membershipId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Membre retiré' });
      invalidate();
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  // Promote to owner
  const promoteOwnerMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'admin_promote_owner', membership_id: membershipId, exhibitor_id: exhibitorId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Owner mis à jour' });
      invalidate();
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  // Revoke governance
  const revokeGovernanceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'admin_revoke_governance', exhibitor_id: exhibitorId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Gouvernance révoquée' });
      invalidate();
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { exhibitor: ex, team_members, pending_invitations = [], claims } = data;
  // Only show pending claims in the "active" section
  const pendingClaims = claims.filter(c => c.status === 'pending');
  const processedClaims = claims.filter(c => c.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-3">
          {ex.logo_url ? (
            <img src={ex.logo_url} alt="" className="w-10 h-10 rounded object-contain bg-white border" />
          ) : (
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold">{ex.name}</h2>
            <div className="text-sm text-muted-foreground">{ex.slug}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fiche entreprise */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fiche entreprise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Site web</span>
                  <div className="flex items-center gap-1">
                    {ex.website ? (
                      <a href={ex.website} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1">
                        {ex.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan</span>
                  <div>{ex.plan || 'free'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Vérifiée</span>
                  <div className="flex items-center gap-1">
                    {ex.verified_at ? (
                      <>
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>{new Date(ex.verified_at).toLocaleDateString('fr-FR')}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Non</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <div className="flex gap-2 mt-1">
                    {ex.approved && <Badge variant="secondary">Approuvée</Badge>}
                    {ex.is_test && <Badge className="bg-purple-100 text-purple-800">Test</Badge>}
                    {!ex.approved && !ex.is_test && <Badge variant="outline">Non approuvée</Badge>}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Description</span>
                  {!editing && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setEditDesc(ex.description || ''); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                    </Button>
                  )}
                </div>
                {editing ? (
                  <div className="space-y-2">
                    <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateDescMutation.mutate()} disabled={updateDescMutation.isPending}>
                        <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm">{ex.description || 'Aucune description'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Gestionnaires ({team_members.length})
                </CardTitle>
                {ex.governance_status === 'managed' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('Révoquer toute la gouvernance ? Les membres seront retirés et l\'owner supprimé.')) {
                              revokeGovernanceMutation.mutate();
                            }
                          }}
                        >
                          Révoquer la gouvernance
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Supprime tous les membres et remet l'entreprise en statut "non gérée"
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {team_members.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Aucun gestionnaire — cette entreprise n'est pas gérée
                </div>
              ) : (
                <div className="divide-y">
                  {team_members.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {m.role === 'owner' ? (
                              <Crown className="h-4 w-4 text-amber-600" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            {m.profile?.first_name} {m.profile?.last_name}
                            {m.role === 'owner' && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Owner</Badge>
                            )}
                            {m.role === 'admin' && (
                              <Badge variant="outline" className="text-xs">Admin</Badge>
                            )}
                          </div>
                          {m.profile?.job_title && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {m.profile.job_title}
                              {m.profile.company && <span>— {m.profile.company}</span>}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {m.profile?.email || m.user_id}
                            {m.status !== 'active' && ` — ${m.status}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Depuis le {new Date(m.created_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {m.role !== 'owner' && m.status === 'active' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => promoteOwnerMutation.mutate(m.id)}
                                  disabled={promoteOwnerMutation.isPending}
                                >
                                  <Crown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Promouvoir comme owner</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeMemberMutation.mutate(m.id)}
                                disabled={removeMemberMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Retirer ce gestionnaire</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              {/* Add member */}
              <div>
                <p className="text-sm font-medium mb-2">Ajouter un gestionnaire</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Email de l'utilisateur"
                    value={addUserId}
                    onChange={e => setAddUserId(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => addMemberMutation.mutate(addUserId)}
                    disabled={!addUserId || addMemberMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Governance summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Gouvernance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span>{ex.owner_user_id ? '✓ Défini' : '✗ Aucun'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vérifiée</span>
                <span>{ex.verified_at ? '✓ Oui' : '✗ Non'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approuvée</span>
                <span>{ex.approved ? '✓ Oui' : '✗ Non'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mode test</span>
                <span>{ex.is_test ? '⚗️ Oui' : 'Non'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Membres actifs</span>
                <span>{ex.team_count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pending claims */}
          {pendingClaims.length > 0 && (
            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <Clock className="h-4 w-4" />
                  Demandes en attente ({pendingClaims.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingClaims.map(c => (
                    <div key={c.id} className="text-sm border rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={c.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {(c.profile?.first_name?.[0] || '') + (c.profile?.last_name?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">
                          {c.profile?.first_name} {c.profile?.last_name}
                        </div>
                      </div>
                      {c.profile?.job_title && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {c.profile.job_title}
                          {c.profile.company && <span>— {c.profile.company}</span>}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{c.profile?.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processed claims (history) */}
          {processedClaims.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Historique des demandes ({processedClaims.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {processedClaims.map(c => (
                    <div key={c.id} className="text-sm border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={c.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {(c.profile?.first_name?.[0] || '') + (c.profile?.last_name?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {c.profile?.first_name} {c.profile?.last_name}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{c.profile?.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={c.status === 'approved' ? 'secondary' : 'destructive'} className="text-xs">
                          {c.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          <Card>
            <CardContent className="pt-6 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Créée le</span>
                <span>{ex.created_at ? new Date(ex.created_at).toLocaleDateString('fr-FR') : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mise à jour</span>
                <span>{ex.updated_at ? new Date(ex.updated_at).toLocaleDateString('fr-FR') : '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminExhibitorDetailPanel;
