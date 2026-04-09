import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Check, X, Building2, User, ClipboardList, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

interface ClaimRequest {
  id: string;
  created_at: string;
  status: string;
  requester_user_id: string;
  exhibitor_id: string;
  exhibitor: { id: string; name: string; slug?: string; };
  profile?: { first_name?: string; last_name?: string; email?: string; };
}

const AdminClaimRequests = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['admin-claim-requests', debouncedSearch, statusFilter],
    queryFn: async (): Promise<ClaimRequest[]> => {
      let query = supabase
        .from('exhibitor_claim_requests')
        .select(`
          *,
          exhibitor:exhibitor_id!inner (id, name, slug)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data?.length) return [];

      // Fetch profiles + emails
      const userIds = [...new Set(data.map(r => r.requester_user_id))];
      const profilesRes = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds);
      let emailsRes: { data: any[] } = { data: [] };
      try {
        const res = await supabase.rpc('get_user_emails_for_moderation', { user_ids: userIds });
        emailsRes = { data: res.data || [] };
      } catch { /* non-critical */ }

      const profilesMap: Record<string, any> = {};
      (profilesRes.data || []).forEach((p: any) => { profilesMap[p.user_id] = p; });
      const emailsMap: Record<string, string> = {};
      ((emailsRes as any).data || []).forEach((e: any) => { emailsMap[e.user_id] = e.email; });

      let result = data.map(r => ({
        ...r,
        profile: {
          first_name: profilesMap[r.requester_user_id]?.first_name,
          last_name: profilesMap[r.requester_user_id]?.last_name,
          email: emailsMap[r.requester_user_id],
        },
      }));

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        result = result.filter(r =>
          r.exhibitor?.name?.toLowerCase().includes(q) ||
          r.profile?.first_name?.toLowerCase().includes(q) ||
          r.profile?.last_name?.toLowerCase().includes(q) ||
          r.profile?.email?.toLowerCase().includes(q)
        );
      }

      return result;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: {
          action: action === 'approve' ? 'approve_claim' : 'reject_claim',
          request_id: requestId,
        },
      });
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'approve' ? 'Demande approuvée' : 'Demande rejetée',
        description: action === 'approve'
          ? "L'utilisateur est devenu gestionnaire officiel."
          : 'La demande a été rejetée.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exhibitors'] });
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de traiter la demande.', variant: 'destructive' });
    },
  });

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Demandes de gestion
            {pendingCount > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600">{pendingCount} en attente</Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par entreprise, nom ou email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvées</SelectItem>
              <SelectItem value="rejected">Rejetées</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !requests?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            Aucune demande {statusFilter !== 'all' ? statusFilter === 'pending' ? 'en attente' : statusFilter === 'approved' ? 'approuvée' : 'rejetée' : ''}
          </div>
        ) : (
          <div className="rounded-md border divide-y">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">{r.exhibitor?.name || 'Exposant supprimé'}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {r.profile?.first_name} {r.profile?.last_name}
                      {r.profile?.email && (
                        <span className="text-xs">— {r.profile.email}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        r.status === 'pending' ? 'default' :
                        r.status === 'approved' ? 'secondary' : 'destructive'
                      }>
                        {r.status === 'pending' ? 'En attente' :
                         r.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-2 shrink-0 ml-4">
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ requestId: r.id, action: 'approve' })}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMutation.mutate({ requestId: r.id, action: 'reject' })}
                      disabled={updateMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Refuser
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminClaimRequests;
