import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RequestRow {
  id: string;
  status: string;
  stand: string | null;
  message: string | null;
  admin_note: string | null;
  created_at: string;
  event_id: string | null;
  exhibitor_id: string;
  requested_by: string;
  proposed_event_name: string | null;
  proposed_event_city: string | null;
  proposed_event_start: string | null;
  proposed_event_url: string | null;
  exhibitors: { name: string | null; slug: string | null } | null;
  events: { nom_event: string | null; slug: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  approved: 'Acceptée',
  rejected: 'Refusée',
};

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AdminExhibitorParticipationRequests() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-participation-requests', statusFilter],
    queryFn: async (): Promise<RequestRow[]> => {
      let query = supabase
        .from('exhibitor_participation_requests')
        .select(
          'id, status, stand, message, admin_note, created_at, event_id, exhibitor_id, requested_by, proposed_event_name, proposed_event_city, proposed_event_start, proposed_event_url, exhibitors(name, slug), events(nom_event, slug)',
        )
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as RequestRow[];
    },
  });

  const { data: requesterProfiles = {} } = useQuery({
    queryKey: ['admin-participation-requesters', requests.map((r) => r.requested_by).join(',')],
    enabled: requests.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = Array.from(new Set(requests.map((r) => r.requested_by)));
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
        map[p.user_id] = name || p.user_id;
      }
      return map;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: { id: string; decision: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase.functions.invoke('exhibitor-participation-decide', {
        body: {
          request_id: vars.id,
          decision: vars.decision,
          admin_note: notes[vars.id]?.trim() ? notes[vars.id].trim() : null,
        },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error?: string }).error);
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.decision === 'approved' ? 'Déclaration acceptée' : 'Déclaration refusée',
      );
      queryClient.invalidateQueries({ queryKey: ['admin-participation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exhibitors'] });
    },
    onError: (err: unknown) =>
      toast.error(
        err instanceof Error && err.message ? err.message : "L'action n'a pas pu être appliquée.",
      ),
    onSettled: () => setBusyId(null),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Déclarations de participation</h1>
          <p className="text-sm text-muted-foreground">
            Validez les participations aux salons déclarées par les entreprises exposantes.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Acceptées</SelectItem>
            <SelectItem value="rejected">Refusées</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Aucune déclaration pour ce filtre.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const isPending = r.status === 'pending';
            const busy = busyId === r.id;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-base">
                      {r.exhibitors?.slug ? (
                        <Link
                          to={`/exposants/${r.exhibitors.slug}`}
                          className="hover:text-primary inline-flex items-center gap-1"
                        >
                          {r.exhibitors?.name ?? 'Entreprise'}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        (r.exhibitors?.name ?? 'Entreprise')
                      )}
                    </CardTitle>
                    <Badge variant={isPending ? 'secondary' : 'outline'}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Salon
                      </dt>
                      <dd>
                        {r.event_id && r.events ? (
                          r.events.slug ? (
                            <Link
                              to={`/events/${r.events.slug}`}
                              className="hover:text-primary inline-flex items-center gap-1"
                            >
                              {r.events.nom_event}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            r.events.nom_event
                          )
                        ) : (
                          <span>
                            {r.proposed_event_name ?? 'Salon non précisé'}
                            {[formatDate(r.proposed_event_start), r.proposed_event_city]
                              .filter(Boolean)
                              .length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}
                                (
                                {[formatDate(r.proposed_event_start), r.proposed_event_city]
                                  .filter(Boolean)
                                  .join(' · ')}
                                )
                              </span>
                            )}
                            {r.proposed_event_url && (
                              <>
                                {' '}
                                <a
                                  href={r.proposed_event_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline underline-offset-4"
                                >
                                  site officiel
                                </a>
                              </>
                            )}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Stand
                      </dt>
                      <dd>{r.stand || 'Non renseigné'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Demandeur
                      </dt>
                      <dd>{requesterProfiles[r.requested_by] ?? r.requested_by}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Date de la demande
                      </dt>
                      <dd>{formatDate(r.created_at)}</dd>
                    </div>
                  </dl>

                  {r.message && (
                    <p className="text-sm bg-muted/40 rounded-md p-3">{r.message}</p>
                  )}

                  {!r.event_id && isPending && (
                    <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm">
                        Ce salon n'existe pas encore sur Lotexpo. Créez d'abord le salon dans
                        l'administration, puis revenez valider cette déclaration.
                      </p>
                    </div>
                  )}

                  {r.admin_note && !isPending && (
                    <p className="text-xs text-muted-foreground">
                      Note enregistrée : {r.admin_note}
                    </p>
                  )}

                  {isPending && (
                    <div className="space-y-2">
                      <Input
                        value={notes[r.id] ?? ''}
                        onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                        placeholder="Note interne (facultative)"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setBusyId(r.id);
                            reviewMutation.mutate({ id: r.id, decision: 'approved' });
                          }}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-1.5" />
                          )}
                          Accepter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setBusyId(r.id);
                            reviewMutation.mutate({ id: r.id, decision: 'rejected' });
                          }}
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          Refuser
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
