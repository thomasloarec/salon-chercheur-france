
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Database, Users, Link, ArrowUpDown, Download } from 'lucide-react';

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

  // Synchronisation VERS Airtable (upload)
  const handleSyncEventsToAirtable = async () => {
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
        headers: {
          'X-Lovable-Admin': 'true'
        },
        body: {
          table: 'All_Events', // Table Airtable correcte
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
          description: `Événements envoyés vers Airtable`,
        });
        onSync('events');
      } else {
        throw new Error(data.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('[AIRTABLE] Erreur sync events vers Airtable:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  };

  // Import DEPUIS Airtable vers Supabase
  const handleImportEventsFromAirtable = async () => {
    try {
      console.log('[SYNC] Import depuis Airtable vers staging_events_import...');
      
      // 1. Lire les données depuis Airtable
      const { data: airtableData, error: readError } = await supabase.functions.invoke('airtable-read', {
        method: 'POST',
        headers: {
          'X-Lovable-Admin': 'true'
        },
        body: {
          table: 'All_Events'
        }
      });

      if (readError) throw readError;

      if (!airtableData.success || !airtableData.records) {
        throw new Error('Aucune donnée reçue d\'Airtable');
      }

      console.log('[SYNC] Données reçues d\'Airtable:', airtableData.records.length);

      // 2. Transformer et insérer dans events_import
      const recordsToInsert = airtableData.records.map((record: any) => ({
        id: record.id_event || `airtable_${Date.now()}_${Math.random()}`,
        nom_event: record.nom_event,
        type_event: record.type_event,
        date_debut: record.date_debut,
        date_fin: record.date_fin,
        secteur: record.secteur,
        ville: record.ville,
        rue: record.rue,
        code_postal: record.code_postal || record.postal_code,
        nom_lieu: record.nom_lieu,
        url_image: record.url_image,
        url_site_officiel: record.url_site_officiel,
        description_event: record.description_event,
        affluence: record.affluence?.toString(),
        tarifs: record.tarif,
        status_event: 'imported_from_airtable'
      }));

      // 3. Insérer dans Supabase staging_events_import
      const { data: insertData, error: insertError } = await supabase
        .from('staging_events_import')
        .upsert(recordsToInsert, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (insertError) throw insertError;

      toast({
        title: 'Import réussi',
        description: `${recordsToInsert.length} événements importés depuis Airtable vers staging_events_import`,
      });

      onSync('events');

    } catch (error) {
      console.error('[SYNC] Erreur import depuis Airtable:', error);
      toast({
        title: 'Erreur d\'import',
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
        headers: {
          'X-Lovable-Admin': 'true'
        },
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
        headers: {
          'X-Lovable-Admin': 'true'
        },
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
      await handleSyncEventsToAirtable();
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
    onSyncClick: () => void,
    onImportClick?: () => void
  ) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count.toLocaleString()}</div>
        <div className="space-y-2 mt-2">
          <Button 
            onClick={onSyncClick}
            disabled={isLoading || count === 0}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Sync → Airtable
          </Button>
          {onImportClick && (
            <Button 
              onClick={onImportClick}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Import ← Airtable
            </Button>
          )}
        </div>
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
          handleSyncEventsToAirtable,
          handleImportEventsFromAirtable
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
          Synchroniser tout vers Airtable
        </Button>
      </div>
    </div>
  );
};

export default AirtableSyncButtons;
