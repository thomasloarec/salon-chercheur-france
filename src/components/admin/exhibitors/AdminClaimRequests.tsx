import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Check, X, Building2, User, ClipboardList, RefreshCw, Briefcase, Phone, Mail, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

interface ClaimRequestProfile {
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  job_title?: string;
  company?: string;
  phone?: string;
  primary_sector?: string;
}

interface ClaimRequest {
  id: string;
  created_at: string;
  status: string;
  requester_user_id: string;
  exhibitor_id: string;
  exhibitor: { id: string; name: string; slug?: string; };
  profile?: ClaimRequestProfile;
}

interface Props {
  onSelectExhibitor?: (id: string) => void;
}

const AdminClaimRequests = ({ onSelectExhibitor }: Props) => {
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
      const [profilesRes, emailsRes, sectorsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, first_name, last_name, avatar_url, job_title, company, primary_sector').in('user_id', userIds),
        supabase.rpc('get_user_emails_for_moderation', { user_ids: userIds }).then(r => ({ data: r.data || [] as any[] }), () => ({ data: [] as any[] })),
        supabase.from('sectors').select('id, name'),
      ]);

      const profilesMap: Record<string, any> = {};
      (profilesRes.data || []).forEach((p: any) => { profilesMap[p.user_id] = p; });
      const emailsMap: Record<string, string> = {};
      ((emailsRes as any).data || []).forEach((e: any) => { emailsMap[e.user_id] = e.email; });
      const sectorsMap: Record<string, string> = {};
      (sectorsRes.data || []).forEach((s: any) => { sectorsMap[s.id] = s.name; });

      let result = data.map(r => ({
        ...r,
        profile: {
          first_name: profilesMap[r.requester_user_id]?.first_name,
          last_name: profilesMap[r.requester_user_id]?.last_name,
          email: emailsMap[r.requester_user_id],
          avatar_url: profilesMap[r.requester_user_id]?.avatar_url,
          job_title: profilesMap[r.requester_user_id]?.job_title,
          company: profilesMap[r.requester_user_id]?.company,
          phone: undefined, // phone not in profiles table schema visible
          primary_sector: profilesMap[r.requester_user_id]?.primary_sector
            ? sectorsMap[profilesMap[r.requester_user_id].primary_sector] || profilesMap[r.requester_user_id].primary_sector
            : undefined,
        },
      }));

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        result = result.filter(r =>
          r.exhibitor?.name?.toLowerCase().includes(q) ||
          r.profile?.first_name?.toLowerCase().includes(q) ||
          r.profile?.last_name?.toLowerCase().includes(q) ||
          r.profile?.email?.toLowerCase().includes(q) ||
          r.profile?.company?.toLowerCase().includes(q)
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
      queryClient.invalidateQueries({ queryKey: ['admin-exhibitor-detail'] });
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
              placeholder="Rechercher par entreprise, nom, email ou société..."
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
              <div key={r.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Exhibitor + User info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Exhibitor row */}
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <button
                        onClick={() => onSelectExhibitor?.(r.exhibitor_id)}
                        className="font-semibold text-primary hover:underline truncate"
                      >
                        {r.exhibitor?.name || 'Exposant supprimé'}
                      </button>
                      <Badge variant={
                        r.status === 'pending' ? 'default' :
                        r.status === 'approved' ? 'secondary' : 'destructive'
                      } className="text-xs shrink-0">
                        {r.status === 'pending' ? 'En attente' :
                         r.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* User detail card */}
                    <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={r.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {(r.profile?.first_name?.[0] || '') + (r.profile?.last_name?.[0] || '') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-sm">
                          {r.profile?.first_name} {r.profile?.last_name}
                        </div>
                        {r.profile?.job_title && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {r.profile.job_title}
                          </div>
                        )}
                        {r.profile?.company && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {r.profile.company}
                          </div>
                        )}
                        {r.profile?.email && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {r.profile.email}
                          </div>
                        )}
                        {r.profile?.primary_sector && (
                          <div className="text-xs text-muted-foreground">
                            Secteur : {r.profile.primary_sector}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  {r.status === 'pending' && (
                    <div className="flex flex-col gap-2 shrink-0">
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminClaimRequests;
