import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Check, X, ExternalLink, Crown, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NoveltyPreviewDialog from '@/components/novelty/NoveltyPreviewDialog';

interface PendingNovelty {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  media_urls: string[];
  doc_url?: string;
  is_premium?: boolean;
  exhibitors: {
    name: string;
    slug: string;
  };
  events: {
    nom_event: string;
    slug: string;
  };
}

export default function NoveltyModeration() {
  const [activeTab, setActiveTab] = useState('pending');
  const [previewNovelty, setPreviewNovelty] = useState<PendingNovelty | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingNovelties, isLoading } = useQuery({
    queryKey: ['admin-novelties', activeTab],
    queryFn: async () => {
      // Map tab to actual DB status values (matching CHECK constraint)
      let statusFilter = 'draft'; // Default: newly submitted novelties
      if (activeTab === 'published') statusFilter = 'published';
      if (activeTab === 'rejected') statusFilter = 'rejected';

      const { data, error } = await supabase
        .from('novelties')
        .select(`
          id, title, type, status, created_at, media_urls, doc_url, is_premium,
          exhibitors!inner ( name, slug ),
          events!inner ( nom_event, slug )
        `)
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingNovelty[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('novelties')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-novelties'] });
      toast({
        title: "Statut mis à jour",
        description: "Le statut de la nouveauté a été modifié."
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive"
      });
    }
  });

  const handlePublish = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'Published' });
  };

  const handleReject = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'Rejected' });
  };

  const togglePremiumMutation = useMutation({
    mutationFn: async ({ id, isPremium }: { id: string; isPremium: boolean }) => {
      const { error } = await supabase
        .from('novelties')
        .update({ is_premium: !isPremium })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-novelties'] });
      toast({
        title: "Statut Premium mis à jour",
        description: "Le statut premium de la nouveauté a été modifié."
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut premium.",
        variant: "destructive"
      });
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: { label: 'En attente', variant: 'secondary' as const },
      under_review: { label: 'En révision', variant: 'default' as const },
      published: { label: 'Publié', variant: 'default' as const },
      rejected: { label: 'Rejeté', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Modération des Nouveautés</h2>
        <p className="text-muted-foreground">
          Gérez les nouveautés soumises par les exposants
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="published">Publiées</TabsTrigger>
          <TabsTrigger value="rejected">Rejetées</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {!pendingNovelties?.length ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Aucune nouveauté trouvée.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingNovelties.map((novelty) => (
                <Card key={novelty.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{novelty.title}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{novelty.exhibitors.name}</span>
                          <span>•</span>
                          <span>{novelty.events.nom_event}</span>
                          <span>•</span>
                          <span>{formatDate(novelty.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(novelty.status)}
                        <Badge variant="outline">{novelty.type}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="font-medium">{novelty.media_urls.length}</span> images
                        </div>
                        {novelty.doc_url && (
                          <div className="flex items-center gap-1 text-sm text-primary">
                            <ExternalLink className="h-3 w-3" />
                            Brochure PDF
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewNovelty(novelty)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Voir
                        </Button>
                        
                        <Button
                          size="sm"
                          variant={novelty.is_premium ? "default" : "outline"}
                          onClick={() => togglePremiumMutation.mutate({ 
                            id: novelty.id, 
                            isPremium: novelty.is_premium || false 
                          })}
                          disabled={togglePremiumMutation.isPending}
                        >
                          {novelty.is_premium ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Premium
                            </>
                          ) : (
                            <>
                              <Crown className="h-4 w-4 mr-1" />
                              Premium
                            </>
                          )}
                        </Button>

                        {activeTab === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(novelty.id)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handlePublish(novelty.id)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Publier
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      {previewNovelty && (
        <NoveltyPreviewDialog
          novelty={previewNovelty}
          open={!!previewNovelty}
          onOpenChange={(open) => !open && setPreviewNovelty(null)}
        />
      )}
    </div>
  );
}