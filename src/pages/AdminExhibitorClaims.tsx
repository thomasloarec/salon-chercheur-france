import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Check, X, User, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface ClaimRequest {
  id: string;
  created_at: string;
  status: string;
  requester_user_id: string;
  exhibitor_id: string;
  exhibitor: {
    id: string;
    name: string;
    slug?: string;
  };
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

export default function AdminExhibitorClaims() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch claim requests
  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['admin-exhibitor-claims', debouncedSearch],
    queryFn: async (): Promise<ClaimRequest[]> => {
      let query = supabase
        .from('exhibitor_claim_requests')
        .select(`
          *,
          exhibitor:exhibitor_id!inner (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (debouncedSearch) {
        query = query.ilike('exhibitor.name', `%${debouncedSearch}%`);
      }

      const { data: requestsData, error } = await query;
      if (error) throw error;

      // Fetch user profiles separately
      if (requestsData && requestsData.length > 0) {
        const userIds = requestsData.map(r => r.requester_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        // Merge profiles with requests
        const requestsWithProfiles = requestsData.map(request => ({
          ...request,
          profiles: profiles?.find(p => p.user_id === request.requester_user_id)
        }));

        return requestsWithProfiles;
      }

      return requestsData || [];
    },
  });

  // Mutation for approving/rejecting requests
  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.functions.invoke('exhibitors-manage', {
        body: {
          action: action === 'approve' ? 'approve_claim' : 'reject_claim',
          request_id: requestId
        }
      });

      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'approve' ? 'Demande approuvée' : 'Demande rejetée',
        description: action === 'approve' 
          ? 'L\'utilisateur a maintenant accès à cet exposant.' 
          : 'La demande a été rejetée.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-exhibitor-claims'] });
    },
    onError: (error) => {
      console.error('Error updating request:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de traiter la demande.',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = (requestId: string) => {
    updateRequestMutation.mutate({ requestId, action: 'approve' });
  };

  const handleReject = (requestId: string) => {
    updateRequestMutation.mutate({ requestId, action: 'reject' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Demandes de co-administration</h1>
            <p className="text-muted-foreground">
              Gestion des demandes d'accès aux profils exposants
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Demandes en attente
                </CardTitle>
                
                {/* Search */}
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom d'exposant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
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
                  <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {debouncedSearch ? 'Aucune demande trouvée' : 'Aucune demande en attente'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests?.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building className="h-6 w-6 text-primary" />
                        </div>
                        
                        <div>
                          <h3 className="font-medium">
                            {request.exhibitor?.name || 'Exposant supprimé'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Demandé par {request.profiles?.first_name} {request.profiles?.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={
                              request.status === 'pending' ? 'default' :
                              request.status === 'approved' ? 'secondary' : 'destructive'
                            }>
                              {request.status === 'pending' ? 'En attente' :
                               request.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(request.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={updateRequestMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <Check className="h-4 w-4" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(request.id)}
                            disabled={updateRequestMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <X className="h-4 w-4" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}