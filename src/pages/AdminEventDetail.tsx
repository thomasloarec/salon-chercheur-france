
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, ExternalLink, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SectorBadge } from '@/components/ui/sector-badge';

const AdminEventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  console.log('AdminEventDetail - id from params:', id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email === 'admin@salonspro.com';

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['admin-event-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID manquant');
      
      console.log('Fetching event with id:', id);
      
      const { data, error } = await supabase
        .from('events_import')
        .select('*')
        .eq('id', id)
        .single();

      console.log('Query result:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      return data;
    },
    enabled: !!id,
  });

  const publishEvent = async () => {
    if (!event) return;

    try {
      console.log('Publishing event:', event);
      
      // Créer l'événement dans la table events de production
      const productionEvent = {
        id_event: event.id,
        nom_event: event.nom_event || '',
        visible: true,
        type_event: event.type_event || 'salon',
        date_debut: event.date_debut || '1970-01-01',
        date_fin: event.date_fin || event.date_debut || '1970-01-01',
        secteur: [event.secteur || 'Autre'],
        ville: event.ville || 'Inconnue',
        rue: event.rue || null,
        code_postal: null,
        pays: 'France',
        url_image: event.url_image || null,
        url_site_officiel: event.url_site_officiel || null,
        description_event: event.description_event || null,
        affluence: event.affluence ? parseInt(event.affluence) : null,
        tarifs: event.tarifs || null,
        nom_lieu: event.nom_lieu || null,
        location: event.ville || 'Inconnue'
      };

      console.log('Creating production event:', productionEvent);

      const { error: insertError } = await supabase
        .from('events')
        .upsert(productionEvent, { 
          onConflict: 'id_event',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      // Supprimer de la table d'import
      const { error: deleteError } = await supabase
        .from('events_import')
        .delete()
        .eq('id', event.id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      toast({
        title: "Événement publié",
        description: "L'événement est maintenant visible au public.",
      });

      navigate('/admin');
    } catch (error) {
      console.error('Error publishing event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de publier l'événement.",
        variant: "destructive",
      });
    }
  };

  const deleteEvent = async () => {
    if (!event) return;

    try {
      console.log('Deleting event:', event.id);
      
      const { error } = await supabase
        .from('events_import')
        .delete()
        .eq('id', event.id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast({
        title: "Événement supprimé",
        description: "L'événement a été supprimé.",
      });

      navigate('/admin');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'événement.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Chargement...">
        <div className="container mx-auto py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-600">Chargement de l'événement...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    console.error('Query error:', error);
    return (
      <MainLayout title="Erreur">
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Erreur de chargement</h1>
            <p className="text-gray-600 mb-6">Une erreur s'est produite : {error.message}</p>
            <Button onClick={() => navigate('/admin')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'administration
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!event) {
    return (
      <MainLayout title="Événement introuvable">
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Événement introuvable</h1>
            <p className="text-gray-600 mb-6">L'événement demandé n'existe pas ou a été supprimé.</p>
            <Button onClick={() => navigate('/admin')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'administration
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Admin - ${event.nom_event || 'Événement'}`}>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header avec navigation */}
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate('/admin')} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          
          <div className="flex gap-2">
            <Button onClick={publishEvent} variant="default">
              <Eye className="h-4 w-4 mr-2" />
              Publier
            </Button>
            <Button onClick={deleteEvent} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Badge de statut */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
            En attente de publication
          </Badge>
        </div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image et informations principales */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{event.nom_event || 'Événement sans nom'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.url_image && (
                  <img
                    src={event.url_image}
                    alt={event.nom_event || 'Image événement'}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {event.date_debut} {event.date_fin && event.date_fin !== event.date_debut && `- ${event.date_fin}`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{event.ville || 'Ville non précisée'}</span>
                </div>
                
                {event.secteur && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Secteur:</span>
                    <SectorBadge label={event.secteur} />
                  </div>
                )}
                
                {event.description_event && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{event.description_event}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Informations complémentaires */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Détails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {event.type_event && (
                  <div>
                    <span className="text-sm font-medium">Type:</span>
                    <p className="text-gray-700">{event.type_event}</p>
                  </div>
                )}
                
                {event.nom_lieu && (
                  <div>
                    <span className="text-sm font-medium">Lieu:</span>
                    <p className="text-gray-700">{event.nom_lieu}</p>
                  </div>
                )}
                
                {event.affluence && (
                  <div>
                    <span className="text-sm font-medium">Affluence:</span>
                    <p className="text-gray-700">{event.affluence}</p>
                  </div>
                )}
                
                {event.tarifs && (
                  <div>
                    <span className="text-sm font-medium">Tarifs:</span>
                    <p className="text-gray-700">{event.tarifs}</p>
                  </div>
                )}
                
                {event.url_site_officiel && (
                  <div>
                    <span className="text-sm font-medium">Site officiel:</span>
                    <a 
                      href={event.url_site_officiel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Visiter <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminEventDetail;
