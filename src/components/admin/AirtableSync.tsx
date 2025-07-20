
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAirtableEvents, useAirtableExposants, useAirtableParticipation, useAirtableSync } from '@/hooks/useAirtable';
import { RefreshCw, Database, Users, Link, ArrowUpDown } from 'lucide-react';

const AirtableSync = () => {
  const { data: events, isLoading: eventsLoading, error: eventsError } = useAirtableEvents();
  const { data: exposants, isLoading: exposantsLoading, error: exposantsError } = useAirtableExposants();
  const { data: participation, isLoading: participationLoading, error: participationError } = useAirtableParticipation();
  
  const { syncEvents, syncExposants, syncParticipation, isLoading: syncLoading } = useAirtableSync();

  const handleSyncEvents = () => {
    if (events) {
      syncEvents.mutate(events.map(event => ({
        id_event: event.id_event,
        nom_event: event.nom_event,
        status_event: event.status_event,
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
      })));
    }
  };

  const handleSyncExposants = () => {
    if (exposants) {
      syncExposants.mutate(exposants.map(exposant => ({
        id_exposant: exposant.id_exposant,
        exposant_nom: exposant.exposant_nom,
        exposant_stand: exposant.exposant_stand,
        exposant_description: exposant.exposant_description,
        website_exposant: exposant.exposant_website || exposant.website_exposant || `${exposant.exposant_nom?.toLowerCase().replace(/\s+/g, '-')}.com`,
      })));
    }
  };

  const handleSyncParticipation = () => {
    if (participation) {
      syncParticipation.mutate(participation.map(p => ({
        id_participation: p.id_participation,
        id_event: p.id_event,
        id_exposant: p.id_exposant,
        urlexpo_event: p.urlexpo_event || `${p.id_exposant}_${p.id_event}`, // Fallback if urlexpo_event is missing
      })));
    }
  };

  const renderStatsCard = (
    title: string,
    count: number | undefined, 
    isLoading: boolean, 
    error: any,
    icon: React.ReactNode,
    onSync: () => void
  ) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : error ? (
            <Badge variant="destructive">Erreur</Badge>
          ) : (
            count?.toLocaleString() || '0'
          )}
        </div>
        <Button 
          onClick={onSync}
          disabled={syncLoading || isLoading || !!error}
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Synchronisation Airtable
          </CardTitle>
          <CardDescription>
            Synchronisez les données entre votre base Supabase et Airtable. 
            Événements utilisent id_event, Exposants utilisent website_exposant, Participation utilise urlexpo_event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">Base Airtable connectée</span>
              <Badge variant="outline">Proxy sécurisé</Badge>
            </div>
            <p className="text-xs text-gray-500">
              Tables: All_Events (id_event), All_Exposants (website_exposant), Participation (urlexpo_event)
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {renderStatsCard(
              'Événements',
              events?.length,
              eventsLoading,
              eventsError,
              <Database className="h-4 w-4" />,
              handleSyncEvents
            )}
            
            {renderStatsCard(
              'Exposants', 
              exposants?.length,
              exposantsLoading,
              exposantsError,
              <Users className="h-4 w-4" />,
              handleSyncExposants
            )}
            
            {renderStatsCard(
              'Participations',
              participation?.length,
              participationLoading,
              participationError,
              <Link className="h-4 w-4" />,
              handleSyncParticipation
            )}
          </div>

          <Separator className="my-4" />

          {/* Sync All Button */}
          <div className="flex justify-center">
            <Button 
              onClick={() => {
                handleSyncEvents();
                handleSyncExposants();
                handleSyncParticipation();
              }}
              disabled={syncLoading || eventsLoading || exposantsLoading || participationLoading}
              size="lg"
              className="w-full md:w-auto"
            >
              {syncLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowUpDown className="h-4 w-4 mr-2" />
              )}
              Synchroniser tout avec Airtable
            </Button>
          </div>

          {/* Error Messages */}
          {(eventsError || exposantsError || participationError) && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Erreurs de connexion :</h4>
              <ul className="text-sm text-red-600 space-y-1">
                {eventsError && <li>• Événements : {eventsError.message}</li>}
                {exposantsError && <li>• Exposants : {exposantsError.message}</li>}
                {participationError && <li>• Participations : {participationError.message}</li>}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AirtableSync;
