import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Check, X, ExternalLink, Crown, ShieldOff, User, Mail, Briefcase, Building2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NoveltyPreviewDialog from '@/components/novelty/NoveltyPreviewDialog';
import { usePremiumGrant } from '@/hooks/usePremiumGrant';
import { PremiumStatusBadge } from './PremiumStatusBadge';
import { PremiumActionButtons } from './PremiumActionButtons';

interface PendingNovelty {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  created_by: string;
  media_urls: string[];
  doc_url?: string;
  exhibitor_id: string;
  event_id: string;
  exhibitors: {
    id: string;
    name: string;
    slug: string;
  };
  events: {
    id: string;
    nom_event: string;
    slug: string;
  };
  creator_profile?: {
    first_name: string;
    last_name: string;
    job_title: string;
    company: string;
    primary_sector: string;
    email: string;
  };
}

export default function NoveltyModeration() {
  const [activeTab, setActiveTab] = useState('pending');
  const [previewNovelty, setPreviewNovelty] = useState<PendingNovelty | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { grantPremium, revokePremium, isGranting, isRevoking } = usePremiumGrant();

  const { data: pendingNovelties, isLoading } = useQuery({
    queryKey: ['admin-novelties', activeTab],
    queryFn: async () => {
      // Map tab to actual DB status values (matching CHECK constraint)
      let statusFilter = 'draft'; // Default: newly submitted novelties
      if (activeTab === 'published') statusFilter = 'published';
      if (activeTab === 'rejected') statusFilter = 'rejected';

      // Fetch novelties with creator profile information
      const { data: novelties, error } = await supabase
        .from('novelties')
        .select(`
          id, title, type, status, created_at, created_by, media_urls, doc_url, exhibitor_id, event_id, reason_1, stand_info,
          exhibitors!novelties_exhibitor_id_fkey ( id, name, slug ),
          events!inner ( id, nom_event, slug )
        `)
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator profiles
      const creatorIds = novelties?.map(n => n.created_by).filter(Boolean) || [];
      const uniqueCreatorIds = [...new Set(creatorIds)];

      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          user_id, first_name, last_name, job_title, company, primary_sector,
          sectors:primary_sector ( name )
        `)
        .in('user_id', uniqueCreatorIds);

      // Fetch user emails via RPC function
      const { data: emails } = await supabase.rpc('get_user_emails_for_moderation', {
        user_ids: uniqueCreatorIds
      });

      // Enrich novelties with creator profile data
      const enrichedNovelties = novelties?.map(novelty => {
        const profile = profiles?.find(p => p.user_id === novelty.created_by);
        const sectorName = profile?.sectors?.name || '';
        const userEmail = emails?.find((e: any) => e.user_id === novelty.created_by)?.email || 'Email non disponible';

        return {
          ...novelty,
          creator_profile: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            job_title: profile.job_title || '',
            company: profile.company || '',
            primary_sector: sectorName,
            email: userEmail
          } : undefined
        };
      });

      return enrichedNovelties as PendingNovelty[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Use Edge Function with service role to bypass RLS
      const { data, error } = await supabase.functions.invoke('novelties-moderate', {
        body: { 
          novelty_id: id, 
          next_status: status 
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-novelties'] });
      toast({
        title: "Statut mis à jour",
        description: "Le statut de la nouveauté a été modifié."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de mettre à jour le statut.",
        variant: "destructive"
      });
      console.error('[NoveltyModeration] Update error:', error);
    }
  });

  const handlePublish = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'published' });
  };

  const handleReject = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'rejected' });
  };

  const handleGrantPremium = (exhibitorId: string, eventId: string) => {
    grantPremium({
      exhibitor_id: exhibitorId,
      event_id: eventId,
      max_novelties: 5,
      leads_unlimited: true,
      csv_export: true,
    });
  };

  const handleRevokePremium = (exhibitorId: string, eventId: string) => {
    revokePremium({
      exhibitor_id: exhibitorId,
      event_id: eventId,
    });
  };

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
                        <PremiumStatusBadge 
                          exhibitorId={novelty.exhibitor_id}
                          eventId={novelty.event_id}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* User Information Section */}
                    {novelty.creator_profile && (
                      <div className="p-4 bg-muted/50 rounded-lg border">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Utilisateur
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">Nom :</span>
                            <span>{novelty.creator_profile.first_name} {novelty.creator_profile.last_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">Fonction :</span>
                            <span>{novelty.creator_profile.job_title || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">Entreprise :</span>
                            <span>{novelty.creator_profile.company || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">Email :</span>
                            <span className="text-xs">{novelty.creator_profile.email || 'N/A'}</span>
                          </div>
                          {novelty.creator_profile.primary_sector && (
                            <div className="flex items-center gap-2 col-span-2">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">Secteur :</span>
                              <span>{novelty.creator_profile.primary_sector}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
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
                        
                        <PremiumActionButtons
                          exhibitorId={novelty.exhibitor_id}
                          eventId={novelty.event_id}
                          onGrant={() => handleGrantPremium(novelty.exhibitor_id, novelty.event_id)}
                          onRevoke={() => handleRevokePremium(novelty.exhibitor_id, novelty.event_id)}
                          isGranting={isGranting}
                          isRevoking={isRevoking}
                        />

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