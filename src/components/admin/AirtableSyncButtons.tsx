
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Database, Users, Link, ArrowUpDown } from 'lucide-react';

interface SyncButtonsProps {
  eventsData: any[];
  exposantsData: any[];
  participationData: any[];
  isLoading: boolean;
  onSync: (type: 'events' | 'exposants' | 'participation') => void;
}

const AirtableSyncButtons: React.FC<SyncButtonsProps> = ({
  eventsData,
  exposantsData,
  participationData,
  isLoading,
  onSync
}) => {
  const { toast } = useToast();

  const handleSyncEvents = async () => {
    try {
      if (!eventsData || eventsData.length === 0) {
        toast({
          title: 'Aucune donnée à synchroniser',
          description: 'Aucun événement trouvé',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'All_Events',
          records: eventsData.map(event => ({
            id_event: event.id_event,
            nom_event: event.nom_event,
            type_event: event.type_event,
            date_debut: event.date_debut,
            date_fin: event.date_fin,
            secteur: event.secteur,
            url_image: event.url_image,
            url_site_officiel: event.url_site_officiel,
            description_event: event.description_event,
            affluence: event.affluence,
            tarif: event.tarif,
            nom_lieu: event.nom_lieu,
            rue: event.rue,
            code_postal: event.code_postal,
            ville: event.ville,
            pays: event.pays || 'France'
          }))
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Synchronisation réussie',
          description: `Événements synchronisés avec Airtable`,
        });
        onSync('events');
      } else {
        throw new Error(data.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('[AIRTABLE] Erreur sync events:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  };

  const handleSyncExposants = async () => {
    try {
      if (!exposantsData || exposantsData.length === 0) {
        toast({
          title: 'Aucune donnée à synchroniser',
          description: 'Aucun exposant trouvé',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'All_Exposants',
          records: exposantsData.map(exposant => ({
            id_exposant: exposant.id_exposant,
            nom_exposant: exposant.nom_exposant,
            website_exposant: exposant.website_exposant,
            exposant_description: exposant.exposant_description,
          }))
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Synchronisation réussie',
          description: `Exposants synchronisés avec Airtable`,
        });
        onSync('exposants');
      } else {
        throw new Error(data.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('[AIRTABLE] Erreur sync exposants:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  };

  const handleSyncParticipation = async () => {
    try {
      if (!participationData || participationData.length === 0) {
        toast({
          title: 'Aucune donnée à synchroniser',
          description: 'Aucune participation trouvée',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'Participation',
          records: participationData.map(p => ({
            id_participation: p.id_participation,
            id_event: p.id_event,
            nom_exposant: p.nom_exposant,
            stand_exposant: p.stand_exposant,
            website_exposant: p.website_exposant,
            urlexpo_event: p.urlexpo_event || `${p.id_participation}_${Date.now()}`,
          }))
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Synchronisation réussie',
          description: `Participations synchronisées avec Airtable`,
        });
        onSync('participation');
      } else {
        throw new Error(data.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('[AIRTABLE] Erreur sync participation:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  };

  const handleSyncAll = async () => {
    try {
      await handleSyncEvents();
      await handleSyncExposants();
      await handleSyncParticipation();
    } catch (error) {
      console.error('[AIRTABLE] Erreur sync all:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  };

  const renderStatsCard = (
    title: string,
    count: number,
    icon: React.ReactNode,
    onSyncClick: () => void
  ) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count.toLocaleString()}</div>
        <Button 
          onClick={onSyncClick}
          disabled={isLoading || count === 0}
          variant="outline"
          size="sm"
          className="mt-2 w-full"
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Synchroniser
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderStatsCard(
          'Événements',
          eventsData?.length || 0,
          <Database className="h-4 w-4" />,
          handleSyncEvents
        )}
        
        {renderStatsCard(
          'Exposants', 
          exposantsData?.length || 0,
          <Users className="h-4 w-4" />,
          handleSyncExposants
        )}
        
        {renderStatsCard(
          'Participations',
          participationData?.length || 0,
          <Link className="h-4 w-4" />,
          handleSyncParticipation
        )}
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleSyncAll}
          disabled={isLoading}
          size="lg"
          className="w-full md:w-auto"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ArrowUpDown className="h-4 w-4 mr-2" />
          )}
          Synchroniser tout avec Airtable
        </Button>
      </div>
    </div>
  );
};

export default AirtableSyncButtons;
