import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Building2, Users, Loader2, MoreHorizontal, Lock, Minus, Plus, Ticket } from 'lucide-react';

type RadarPlan = 'trial' | 'free' | 'paid' | 'beta';

interface RadarSpaceRow {
  account_id: string;
  name: string | null;
  org_name: string | null;
  plan: string;
  trial_ends_at: string | null;
  members: number;
  companies: number;
  created_at: string;
  paid_seats: number;
}

interface RadarSpaceMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  last_seen_at: string | null;
  created_at: string;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

// New access model: a member has access if they occupy a paid seat OR their
// personal 7-day trial is still valid. Account plan only overrides:
// 'beta' = free access, 'free' = locked. Otherwise `paid_seats` drives access.
const statusLabel = (s: RadarSpaceRow) => {
  if (s.plan === 'beta') return 'Beta';
  if (s.plan === 'free') return 'Verrouillé';
  if (s.paid_seats > 0) return 'Sièges payants';
  return 'Essai';
};

const statusVariant = (s: RadarSpaceRow): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s.plan === 'beta') return 'default';
  if (s.plan === 'free') return 'destructive';
  if (s.paid_seats > 0) return 'default';
  return 'secondary';
};

const RadarCrmSpacesPanel: React.FC = () => {
  const [spaces, setSpaces] = useState<RadarSpaceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seatsBusyId, setSeatsBusyId] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<RadarSpaceRow | null>(null);
  const [membersByAccount, setMembersByAccount] = useState<
    Record<string, RadarSpaceMember[] | 'loading'>
  >({});

  const loadSpaces = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_radar_accounts');
    if (error) {
      setErr(error.message);
      setSpaces([]);
      return;
    }
    setSpaces((data as unknown as RadarSpaceRow[]) ?? []);
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const loadMembers = useCallback(
    async (accountId: string) => {
      if (membersByAccount[accountId]) return;
      setMembersByAccount((prev) => ({ ...prev, [accountId]: 'loading' }));
      const { data, error } = await supabase.rpc('admin_list_radar_account_members', {
        p_account_id: accountId,
      });
      setMembersByAccount((prev) => ({
        ...prev,
        [accountId]: error ? [] : ((data as unknown as RadarSpaceMember[]) ?? []),
      }));
    },
    [membersByAccount],
  );

  const setPlan = async (space: RadarSpaceRow, plan: RadarPlan) => {
    setBusyId(space.account_id);
    const { error } = await supabase.rpc('admin_set_radar_plan', {
      p_account_id: space.account_id,
      p_plan: plan,
    });
    setBusyId(null);
    setLockTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Plan mis à jour');
    await loadSpaces();
  };

  const setPaidSeats = async (space: RadarSpaceRow, seats: number) => {
    const next = Math.max(0, Math.floor(seats));
    if (next === space.paid_seats) return;
    setSeatsBusyId(space.account_id);
    const { error } = await supabase.rpc('admin_set_radar_paid_seats', {
      p_account_id: space.account_id,
      p_paid_seats: next,
    });
    setSeatsBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Sièges payants mis à jour');
    await loadSpaces();
  };

  if (err) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Espaces Radar CRM
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-destructive">Erreur : {err}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Espaces Radar CRM
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visibilité équipe et gestion du compte (plan, accès, membres).
        </p>
      </CardHeader>
      <CardContent>
        {!spaces ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : spaces.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun espace collaboratif pour le moment.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {spaces.map((s) => {
              const displayName = s.org_name?.trim() || s.name || 'Espace sans nom';
              const members = membersByAccount[s.account_id];
              const busy = busyId === s.account_id;
              const seatsBusy = seatsBusyId === s.account_id;
              const inTrial = Math.max(0, s.members - s.paid_seats);
              return (
                <AccordionItem key={s.account_id} value={s.account_id}>
                  <AccordionTrigger
                    className="hover:no-underline"
                    onClick={() => loadMembers(s.account_id)}
                  >
                    <div className="flex flex-1 flex-col gap-1 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Créateur : {s.name ?? '—'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(s)}>{statusLabel(s)}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {s.members}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Ticket className="h-3 w-3" /> {s.paid_seats} siège{s.paid_seats > 1 ? 's' : ''} payant
                          {s.paid_seats > 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline">{s.companies} entreprises</Badge>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(s.created_at)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={busy}
                              aria-label="Gérer le plan"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              disabled={busy || s.plan === 'beta'}
                              onSelect={() => setPlan(s, 'beta')}
                            >
                              Beta (accès libre)
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              Activer / Essai 7j — gérés par sièges payants
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={busy || s.plan === 'free'}
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setLockTarget(s)}
                            >
                              <Lock className="h-4 w-4" /> Verrouiller
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-primary" /> Sièges payants
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.members} membre{s.members > 1 ? 's' : ''} / {s.paid_seats} siège
                            {s.paid_seats > 1 ? 's' : ''} payant{s.paid_seats > 1 ? 's' : ''}
                            {inTrial > 0 && (
                              <span className="font-medium text-destructive"> · {inTrial} en essai</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={seatsBusy || s.paid_seats <= 0}
                            aria-label="Retirer un siège payant"
                            onClick={() => setPaidSeats(s, s.paid_seats - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            value={s.paid_seats}
                            disabled={seatsBusy}
                            aria-label="Nombre de sièges payants"
                            className="h-8 w-16 text-center"
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v)) setPaidSeats(s, v);
                            }}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={seatsBusy}
                            aria-label="Ajouter un siège payant"
                            onClick={() => setPaidSeats(s, s.paid_seats + 1)}
                          >
                            {seatsBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {members === 'loading' || members === undefined ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des membres…
                      </div>
                    ) : members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">Aucun membre.</p>
                    ) : (
                      <ul className="divide-y">
                        {members.map((m) => {
                          const isOwner = m.role === 'owner';
                          const isRevoked = m.status !== 'active';
                          return (
                            <li
                              key={m.user_id}
                              className="flex flex-wrap items-center justify-between gap-2 py-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {m.display_name?.trim() || m.email || 'Membre'}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {m.email ?? '—'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={isOwner ? 'default' : 'secondary'}>
                                  {isOwner ? 'Super admin' : 'Membre'}
                                </Badge>
                                <Badge variant={isRevoked ? 'destructive' : 'outline'}>
                                  {isRevoked ? 'revoked' : 'active'}
                                </Badge>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>

      <AlertDialog
        open={!!lockTarget}
        onOpenChange={(open) => !open && setLockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verrouiller cet espace ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action passe l'espace «{' '}
              {lockTarget?.org_name?.trim() || lockTarget?.name || 'Espace sans nom'} » en plan{' '}
              <strong>free</strong> et retire immédiatement l'accès au Radar CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => lockTarget && setPlan(lockTarget, 'free')}>
              Verrouiller
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default RadarCrmSpacesPanel;
