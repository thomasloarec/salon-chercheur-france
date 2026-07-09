import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, CalendarDays, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventClaimRequest {
  id: string;
  created_at: string;
  status: string;
  message: string | null;
  event_id: string;
  requester_user_id: string;
  event?: {
    id: string;
    nom_event: string;
    slug: string | null;
  };
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

export default function AdminEventClaims() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['admin-event-claims'],
    queryFn: async (): Promise<EventClaimRequest[]> => {
      const { data: requestsData, error } = await supabase
        .from('event_claim_requests')
        .select('id, status, message, created_at, event_id, requester_user_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!requestsData || requestsData.length === 0) return [];

      // Lookup events
      const eventIds = [...new Set(requestsData.map((r) => r.event_id))];
      const { data: events } = await supabase
        .from('events')
        .select('id, nom_event, slug')
        .in('id', eventIds);

      // Lookup requester profiles
      const userIds = [...new Set(requestsData.map((r) => r.requester_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      return requestsData.map((request) => ({
        ...request,
        event: events?.find((e) => e.id === request.event_id),
        profiles: profiles?.find((p) => p.user_id === request.requester_user_id),
      }));
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.functions.invoke('event-claim-manage', {
        body: { action, request_id: requestId },
      });
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'approve' ? 'Demande approuvée' : 'Demande rejetée',
        description:
          action === 'approve'
            ? "Le demandeur gère désormais ce salon."
            : 'La demande a été rejetée.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-event-claims'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err?.message || 'Impossible de traiter la demande.',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = (requestId: string) =>
    updateRequestMutation.mutate({ requestId, action: 'approve' });
  const handleReject = (requestId: string) =>
    updateRequestMutation.mutate({ requestId, action: 'reject' });

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Revendications de salons</h1>
        <p className="text-muted-foreground">
          Gestion des demandes de revendication des pages salon par les organisateurs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Demandes en attente
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">Erreur lors du chargement des demandes</p>
            </div>
          ) : requests?.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune demande en attente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests?.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <CalendarDays className="h-6 w-6 text-primary" />
                    </div>

                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        {request.event?.nom_event || 'Salon supprimé'}
                        {request.event?.slug && (
                          <Link
                            to={`/events/${request.event.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Demandé par {request.profiles?.first_name} {request.profiles?.last_name}
                      </p>
                      {request.message && (
                        <p className="text-sm text-foreground/70 mt-1 italic">
                          « {request.message} »
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge>En attente</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={updateRequestMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                      disabled={updateRequestMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Refuser
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
