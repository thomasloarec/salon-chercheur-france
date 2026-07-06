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
import { toast } from 'sonner';
import { Building2, Users, Loader2, MoreHorizontal, Lock } from 'lucide-react';

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

const trialActive = (s: RadarSpaceRow) =>
  s.plan === 'trial' && !!s.trial_ends_at && new Date(s.trial_ends_at) > new Date();

const hasAccess = (s: RadarSpaceRow) =>
  s.plan === 'paid' || s.plan === 'beta' || trialActive(s);

const trialDaysLeft = (iso: string | null) => {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
};

const statusLabel = (s: RadarSpaceRow) => {
  if (s.plan === 'paid') return 'Payant';
  if (s.plan === 'beta') return 'Beta';
  if (s.plan === 'trial') {
    return trialActive(s) ? `Essai (${trialDaysLeft(s.trial_ends_at)}j)` : 'Essai expiré';
  }
  return 'Verrouillé';
};

const statusVariant = (s: RadarSpaceRow): 'default' | 'secondary' | 'destructive' | 'outline' =>
  hasAccess(s) ? 'default' : s.plan === 'free' ? 'destructive' : 'secondary';

const RadarCrmSpacesPanel: React.FC = () => {
  const [spaces, setSpaces] = useState<RadarSpaceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
                              disabled={busy || s.plan === 'paid'}
                              onSelect={() => setPlan(s, 'paid')}
                            >
                              Activer (Payant)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={busy || s.plan === 'beta'}
                              onSelect={() => setPlan(s, 'beta')}
                            >
                              Beta
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={busy}
                              onSelect={() => setPlan(s, 'trial')}
                            >
                              Essai 7j
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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
