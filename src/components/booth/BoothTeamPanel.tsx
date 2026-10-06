import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  boothErrorMessage,
  inviteMember,
  listMembers,
  revokeMember,
  type BoothInviteResult,
  type BoothMember,
  type BoothMemberRole,
} from '@/lib/booth/rpc';

const MAX_SEATS = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAN_TEXT = "L'invitation d'équipe est incluse dans la bêta, le Pass Salon et l'Annuel.";

const fmt = (d: string) => format(new Date(d), 'd MMMM yyyy', { locale: fr });

interface Props {
  exhibitorId: string;
  isPaid: boolean;
}

export default function BoothTeamPanel({ exhibitorId, isPaid }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['booth-members', exhibitorId];
  const q = useQuery({ queryKey: key, queryFn: () => listMembers(exhibitorId) });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<BoothMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const isManager = q.data?.role === 'manager';
  const items = q.data?.items ?? [];
  const nonInherited = items.filter((m) => !m.inherited);
  const seats = nonInherited.filter((m) => m.status === 'active' || m.status === 'invited').length;

  const resend = async (m: BoothMember) => {
    if (!m.email || !m.member_id) return;
    setBusyId(m.member_id);
    try {
      const r = await inviteMember(exhibitorId, m.email, m.role);
      if (r.email_sent) toast.success(`Invitation envoyée à ${r.email}`);
      else toast.warning("L'email n'a pas pu partir. Annulez puis réinvitez pour obtenir un nouveau lien.");
      refresh();
    } catch (e) {
      toast.error(boothErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (m: BoothMember) => {
    if (!m.member_id) return;
    setBusyId(m.member_id);
    try {
      await revokeMember(m.member_id);
      refresh();
    } catch (e) {
      toast.error(boothErrorMessage(e));
    } finally {
      setBusyId(null);
      setToRemove(null);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Votre équipe sur le stand</CardTitle>
          {q.data && (
            <span className="text-sm text-muted-foreground">
              {seats} / {MAX_SEATS} comptes
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Chaque membre enregistre ses rencontres sur le stand. Tout le monde partage les mêmes contacts.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : q.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
            <p>{boothErrorMessage(q.error)}</p>
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {items.map((m, i) => {
                const expired =
                  m.status === 'invited' && !!m.invite_expires_at && new Date(m.invite_expires_at) < new Date();
                const busy = !!m.member_id && busyId === m.member_id;
                const canRemove =
                  isManager && !m.inherited && m.status === 'active' && m.user_id !== user?.id;
                return (
                  <li key={m.member_id ?? m.user_id ?? i} className="py-3 space-y-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.display_name}</p>
                      {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{m.role === 'manager' ? 'Manager' : 'Commercial terrain'}</Badge>
                      {m.inherited && <Badge variant="outline">Gestionnaire de la fiche</Badge>}
                      {m.status === 'invited' &&
                        (expired ? (
                          <Badge variant="destructive">Invitation expirée</Badge>
                        ) : (
                          <>
                            <Badge variant="outline">Invitation envoyée</Badge>
                            {m.invite_expires_at && (
                              <span className="text-xs text-muted-foreground">
                                expire le {fmt(m.invite_expires_at)}
                              </span>
                            )}
                          </>
                        ))}
                    </div>
                    {isManager && m.status === 'invited' && !m.inherited && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => resend(m)}>
                          {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                          Renvoyer
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(m)}>
                          Annuler
                        </Button>
                      </div>
                    )}
                    {canRemove && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setToRemove(m)}>
                        Retirer
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {nonInherited.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Vous êtes seul pour l'instant. Invitez les commerciaux qui tiendront le stand.
              </p>
            )}
            {isManager && (
              <div className="space-y-2">
                <Button className="w-full sm:w-auto" disabled={!isPaid} onClick={() => setInviteOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Inviter un collaborateur
                </Button>
                {!isPaid && <p className="text-sm text-muted-foreground">{PLAN_TEXT}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>

      {inviteOpen && (
        <InviteDialog exhibitorId={exhibitorId} onClose={() => setInviteOpen(false)} onDone={refresh} />
      )}

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.display_name} n'aura plus accès à Lotexpo Leads pour cette entreprise. Ses saisies restent
              conservées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busyId}
              onClick={(e) => {
                e.preventDefault();
                if (toRemove) revoke(toRemove);
              }}
            >
              {busyId && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function InviteDialog({
  exhibitorId,
  onClose,
  onDone,
}: {
  exhibitorId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoothMemberRole>('field');
  const [result, setResult] = useState<BoothInviteResult | null>(null);
  const valid = EMAIL_RE.test(email.trim());

  const m = useMutation({
    mutationFn: () => inviteMember(exhibitorId, email.trim(), role),
    onSuccess: (r) => {
      setResult(r);
      if (r.email_sent) toast.success(`Invitation envoyée à ${r.email}`);
      else toast.warning("L'email n'a pas pu partir. Copiez le lien ci-dessous et envoyez-le vous-même.");
      onDone();
    },
    onError: (e) => toast.error(boothErrorMessage(e)),
  });

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.invite_url);
      toast.success('Lien copié');
    } catch {
      toast.error('Copie impossible, sélectionnez le lien à la main.');
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un collaborateur</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            <Label htmlFor="booth-invite-url">Lien d'invitation</Label>
            <div className="flex gap-2">
              <Input id="booth-invite-url" readOnly value={result.invite_url} onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" onClick={copy}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copier le lien
              </Button>
            </div>
            <p className="text-muted-foreground">Ce lien n'est affiché qu'une fois. Valable 14 jours.</p>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="booth-invite-email">Adresse email</Label>
              <Input
                id="booth-invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as BoothMemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field">Commercial terrain</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground">
                Commercial terrain : enregistre et suit ses propres rencontres. Manager : voit et corrige tout, gère
                l'équipe et le coût du salon.
              </p>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {result ? (
            <Button onClick={onClose}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={m.isPending}>
                Annuler
              </Button>
              <Button onClick={() => m.mutate()} disabled={!valid || m.isPending}>
                {m.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Inviter
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
