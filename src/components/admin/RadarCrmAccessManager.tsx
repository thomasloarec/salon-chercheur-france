import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Check, X, Mail, Lock, Loader2, Inbox } from 'lucide-react';

type RadarPlan = 'trial' | 'free' | 'paid' | 'beta';

interface RadarAccountRow {
  account_id: string;
  name: string | null;
  plan: RadarPlan;
  trial_ends_at: string | null;
  members: number;
  companies: number;
  created_at: string;
}

interface RadarAccessRequestRow {
  request_id: string;
  user_id: string;
  created_at: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  radar_account_id: string | null;
  account_plan: string | null;
  account_name: string | null;
}

const hasAccess = (a: RadarAccountRow) =>
  a.plan === 'paid' ||
  a.plan === 'beta' ||
  (a.plan === 'trial' && !!a.trial_ends_at && new Date(a.trial_ends_at) > new Date());

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

const accessLabel = (a: RadarAccountRow) => {
  if (a.plan === 'paid') return 'Payant';
  if (a.plan === 'beta') return 'Beta';
  if (a.plan === 'trial') {
    return hasAccess(a) ? `Essai (jusqu'au ${fmtDate(a.trial_ends_at)})` : 'Essai expiré';
  }
  return 'Verrouillé';
};

const planBadgeVariant = (a: RadarAccountRow): 'default' | 'secondary' | 'destructive' | 'outline' =>
  hasAccess(a) ? 'default' : a.plan === 'free' ? 'destructive' : 'secondary';

const statusBadge = (status: RadarAccessRequestRow['status']) => {
  switch (status) {
    case 'pending':
      return { label: 'En attente', variant: 'default' as const };
    case 'contacted':
      return { label: 'Contacté', variant: 'secondary' as const };
    case 'approved':
      return { label: 'Approuvé', variant: 'outline' as const };
    case 'rejected':
      return { label: 'Rejeté', variant: 'destructive' as const };
  }
};

const RadarCrmAccessManager: React.FC = () => {
  const [accounts, setAccounts] = useState<RadarAccountRow[] | null>(null);
  const [requests, setRequests] = useState<RadarAccessRequestRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<RadarAccountRow | null>(null);

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_radar_accounts');
    if (error) {
      toast.error(`Comptes : ${error.message}`);
      setAccounts([]);
      return;
    }
    setAccounts((data as unknown as RadarAccountRow[]) ?? []);
  }, []);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_access_requests');
    if (error) {
      toast.error(`Demandes : ${error.message}`);
      setRequests([]);
      return;
    }
    setRequests((data as unknown as RadarAccessRequestRow[]) ?? []);
  }, []);

  useEffect(() => {
    loadAccounts();
    loadRequests();
  }, [loadAccounts, loadRequests]);

  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    const rank: Record<RadarAccessRequestRow['status'], number> = {
      pending: 0,
      contacted: 1,
      approved: 2,
      rejected: 3,
    };
    return [...requests].sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [requests]);

  const pendingCount = useMemo(
    () => (requests ?? []).filter((r) => r.status === 'pending').length,
    [requests],
  );

  const setPlan = async (account: RadarAccountRow, plan: RadarPlan) => {
    setBusyId(account.account_id);
    const { error } = await supabase.rpc('admin_set_radar_plan', {
      p_account_id: account.account_id,
      p_plan: plan,
    });
    setBusyId(null);
    setLockTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Plan mis à jour');
    await loadAccounts();
  };

  const approveRequest = async (req: RadarAccessRequestRow) => {
    setBusyId(req.request_id);

    // 1) Approval (source of truth) — unchanged.
    const { error: approveErr } = await supabase.rpc('admin_approve_access_request', {
      p_request_id: req.request_id,
    });
    if (approveErr) {
      setBusyId(null);
      toast.error(approveErr.message);
      return;
    }

    // 2) Confirmation email (best-effort — never blocks approval).
    let emailSent = false;
    try {
      const { data, error } = await supabase.functions.invoke('notify-radar-access-approved', {
        body: { request_id: req.request_id },
      });
      emailSent = !error && (data as any)?.emailSent === true;
    } catch {
      emailSent = false;
    }

    setBusyId(null);

    // 3) Toast depends on email result; approval itself succeeded.
    if (emailSent) {
      toast.success('Demande approuvée — email de confirmation envoyé.');
    } else {
      toast.warning("Demande approuvée — l'email de confirmation n'a pas pu être envoyé.");
    }

    await Promise.all([loadRequests(), loadAccounts()]);
  };

  const setRequestStatus = async (
    req: RadarAccessRequestRow,
    status: 'contacted' | 'rejected',
  ) => {
    setBusyId(req.request_id);
    const { error } = await supabase.rpc('admin_set_access_request_status', {
      p_request_id: req.request_id,
      p_status: status,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === 'rejected' ? 'Demande rejetée' : 'Marquée comme contactée');
    await loadRequests();
  };

  return (
    <div className="space-y-8">
      {/* Section A — Demandes d'accès */}
      <section>
        <div className="section-rule mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-display text-xl">Demandes d'accès</h2>
          {requests && (
            <Badge variant={pendingCount > 0 ? 'default' : 'secondary'}>
              <span className="font-display">{pendingCount}</span>&nbsp;en attente
            </Badge>
          )}
        </div>

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {!requests ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : sortedRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2 opacity-60" />
                <p className="text-sm">Aucune demande d'accès.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Demandeur</TableHead>
                    <TableHead>Entreprise / Poste</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Compte lié</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRequests.map((r) => {
                    const sb = statusBadge(r.status);
                    const busy = busyId === r.request_id;
                    const fullName =
                      [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
                    return (
                      <TableRow
                        key={r.request_id}
                        className={r.status === 'pending' ? 'bg-accent/5' : undefined}
                      >
                        <TableCell className="font-medium">{fullName}</TableCell>
                        <TableCell>
                          <div>{r.company ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.job_title ?? '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{r.email ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.phone ?? '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.account_name ?? '—'}
                          {r.account_plan && (
                            <span className="text-xs text-muted-foreground">
                              {' · '}
                              {r.account_plan}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {fmtDate(r.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sb.variant}>{sb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveRequest(r)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Approuver
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRequestStatus(r, 'contacted')}
                                disabled={busy}
                              >
                                <Mail className="h-4 w-4" />
                                Contacté
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRequestStatus(r, 'rejected')}
                                disabled={busy}
                              >
                                <X className="h-4 w-4" />
                                Rejeter
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section B — Comptes Radar */}
      <section>
        <div className="section-rule mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-display text-xl">Comptes Radar</h2>
          {accounts && (
            <Badge variant="secondary">
              <span className="font-display">{accounts.length}</span>&nbsp;comptes
            </Badge>
          )}
        </div>

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {!accounts ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2 opacity-60" />
                <p className="text-sm">Aucun compte Radar.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Accès</TableHead>
                    <TableHead className="text-right">Membres</TableHead>
                    <TableHead className="text-right">Entreprises</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => {
                    const busy = busyId === a.account_id;
                    const access = hasAccess(a);
                    return (
                      <TableRow key={a.account_id}>
                        <TableCell className="font-medium">{a.name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {a.plan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={planBadgeVariant(a)}>{accessLabel(a)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-display">{a.members}</TableCell>
                        <TableCell className="text-right font-display">{a.companies}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {fmtDate(a.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() => setPlan(a, 'paid')}
                              disabled={busy || a.plan === 'paid'}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Activer
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPlan(a, 'beta')}
                              disabled={busy || a.plan === 'beta'}
                            >
                              Beta
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPlan(a, 'trial')}
                              disabled={busy}
                            >
                              Essai 7j
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setLockTarget(a)}
                              disabled={busy || a.plan === 'free'}
                            >
                              <Lock className="h-4 w-4" />
                              Verrouiller
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <AlertDialog
        open={!!lockTarget}
        onOpenChange={(open) => !open && setLockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verrouiller ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action passe le compte « {lockTarget?.name ?? '—'} » en plan{' '}
              <strong>free</strong> et retire immédiatement l'accès au Radar CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => lockTarget && setPlan(lockTarget, 'free')}
            >
              Verrouiller
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RadarCrmAccessManager;