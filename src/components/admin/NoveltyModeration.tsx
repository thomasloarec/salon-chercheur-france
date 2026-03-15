import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, User, Mail, Briefcase, Building2, Tag, CalendarDays, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePremiumGrant } from '@/hooks/usePremiumGrant';
import { PremiumStatusBadge } from './PremiumStatusBadge';
import { PremiumActionButtons } from './PremiumActionButtons';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import type { Novelty } from '@/hooks/useNovelties';

interface CreatorProfile {
  first_name: string;
  last_name: string;
  job_title: string;
  company: string;
  primary_sector: string;
  email: string;
}

interface EnrichedNovelty extends Novelty {
  creator_profile?: CreatorProfile;
}

export default function NoveltyModeration() {
  const [activeTab, setActiveTab] = useState('pending');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { grantPremium, revokePremium, isGranting, isRevoking } = usePremiumGrant();

  const { data: novelties, isLoading } = useQuery({
    queryKey: ['admin-novelties', activeTab],
    queryFn: async () => {
      let statusFilter = 'draft';
      if (activeTab === 'published') statusFilter = 'published';
      if (activeTab === 'rejected') statusFilter = 'rejected';

      const { data: noveltiesData, error } = await supabase
        .from('novelties')
        .select(`
          id, title, type, status, created_at, created_by, media_urls, doc_url,
          exhibitor_id, event_id, reason_1, reason_2, reason_3,
          stand_info, audience_tags, availability, is_premium, updated_at,
          exhibitors!novelties_exhibitor_id_fkey ( id, name, slug, logo_url ),
          events!inner ( id, nom_event, slug, ville )
        `)
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const creatorIds = noveltiesData?.map(n => n.created_by).filter(Boolean) || [];
      const uniqueCreatorIds = [...new Set(creatorIds)];

      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          user_id, first_name, last_name, job_title, company, primary_sector,
          sectors:primary_sector ( name )
        `)
        .in('user_id', uniqueCreatorIds);

      const { data: emails } = await supabase.rpc('get_user_emails_for_moderation', {
        user_ids: uniqueCreatorIds
      });

      return noveltiesData?.map(novelty => {
        const profile = profiles?.find(p => p.user_id === novelty.created_by);
        const sectorName = profile?.sectors?.name || '';
        const userEmail = emails?.find((e: any) => e.user_id === novelty.created_by)?.email || 'N/A';

        return {
          ...novelty,
          likes_count: 0,
          comments_count: 0,
          creator_profile: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            job_title: profile.job_title || '',
            company: profile.company || '',
            primary_sector: sectorName,
            email: userEmail,
          } : undefined,
        } as EnrichedNovelty;
      }) || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.functions.invoke('novelties-moderate', {
        body: { novelty_id: id, next_status: status }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-novelties'] });
      toast({ title: 'Statut mis à jour', description: 'Le statut de la nouveauté a été modifié.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error?.message || 'Impossible de mettre à jour le statut.', variant: 'destructive' });
    }
  });

  const handlePublish = (id: string) => updateStatusMutation.mutate({ id, status: 'published' });
  const handleReject = (id: string) => updateStatusMutation.mutate({ id, status: 'rejected' });

  const handleGrantPremium = (exhibitorId: string, eventId: string) => {
    grantPremium({ exhibitor_id: exhibitorId, event_id: eventId, max_novelties: 5, leads_unlimited: true, csv_export: true });
  };
  const handleRevokePremium = (exhibitorId: string, eventId: string) => {
    revokePremium({ exhibitor_id: exhibitorId, event_id: eventId });
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
      draft: { label: 'En attente', variant: 'secondary' },
      published: { label: 'Publié', variant: 'default' },
      rejected: { label: 'Rejeté', variant: 'destructive' },
    };
    const info = map[status] || map.draft;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Modération des Nouveautés</h2>
        <p className="text-muted-foreground">Gérez les nouveautés soumises par les exposants</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="published">Publiées</TabsTrigger>
          <TabsTrigger value="rejected">Rejetées</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-8 mt-6">
          {!novelties?.length ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Aucune nouveauté trouvée.</p>
              </CardContent>
            </Card>
          ) : (
            novelties.map((novelty) => (
              <div key={novelty.id} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 pb-8 border-b last:border-b-0">
                {/* Left: NoveltyCard rendered exactly as on event page */}
                <div className="flex justify-center">
                  <NoveltyCard novelty={novelty as Novelty} />
                </div>

                {/* Right: Admin sidebar */}
                <div className="space-y-4">
                  {/* Status & type badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(novelty.status)}
                    <Badge variant="outline">{novelty.type}</Badge>
                    <PremiumStatusBadge exhibitorId={novelty.exhibitor_id} eventId={novelty.event_id} />
                  </div>

                  {/* Event info */}
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        Événement
                      </h4>
                      <p className="text-sm font-medium">{novelty.events?.nom_event}</p>
                      {novelty.events?.ville && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {novelty.events.ville}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Soumise le {formatDate(novelty.created_at)}</p>
                    </CardContent>
                  </Card>

                  {/* Creator profile */}
                  {novelty.creator_profile && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Utilisateur
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">Nom :</span>
                            <span className="font-medium">{novelty.creator_profile.first_name} {novelty.creator_profile.last_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">Fonction :</span>
                            <span className="font-medium">{novelty.creator_profile.job_title || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">Entreprise :</span>
                            <span className="font-medium">{novelty.creator_profile.company || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">Email :</span>
                            <span className="font-medium text-xs break-all">{novelty.creator_profile.email}</span>
                          </div>
                          {novelty.creator_profile.primary_sector && (
                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">Secteur :</span>
                              <span className="font-medium">{novelty.creator_profile.primary_sector}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Admin actions */}
                  <div className="space-y-2">
                    <PremiumActionButtons
                      exhibitorId={novelty.exhibitor_id}
                      eventId={novelty.event_id}
                      onGrant={() => handleGrantPremium(novelty.exhibitor_id, novelty.event_id)}
                      onRevoke={() => handleRevokePremium(novelty.exhibitor_id, novelty.event_id)}
                      isGranting={isGranting}
                      isRevoking={isRevoking}
                    />

                    {activeTab === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReject(novelty.id)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Rejeter
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handlePublish(novelty.id)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Publier
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
