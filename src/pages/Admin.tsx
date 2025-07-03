import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import GoogleSheetsImporter from '@/components/GoogleSheetsImporter';
import { 
  ShieldCheck, 
  BarChart3, 
  AlertTriangle, 
  Settings, 
  Download,
  LogOut,
  Calendar,
  Building,
  ExternalLink,
  Image,
  Users
} from 'lucide-react';

const AdminPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalExposants: 0,
    upcomingEvents: 0,
    lastEvent: null
  });
  const [qualityIssues, setQualityIssues] = useState({
    eventsWithoutExposants: [],
    eventsWithoutUrl: [],
    eventsWithoutImage: []
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadQualityIssues();
    }
  }, [isAdmin]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      setUser(session.user);
      
      // Vérifier si l'utilisateur est admin
      if (session.user.email === 'admin@salonspro.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'authentification:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Nombre total d'événements
      const { count: eventsCount } = await supabase
        .from('events_import')
        .select('*', { count: 'exact', head: true });

      // Nombre total d'exposants
      const { count: exposantsCount } = await supabase
        .from('exposants')
        .select('*', { count: 'exact', head: true });

      // Événements à venir
      const { count: upcomingCount } = await supabase
        .from('events_import')
        .select('*', { count: 'exact', head: true })
        .gte('date_debut', new Date().toISOString().split('T')[0]);

      // Dernier événement importé
      const { data: lastEventData } = await supabase
        .from('events_import')
        .select('id, nom_event, date_debut')
        .order('created_at', { ascending: false })
        .limit(1);

      setStats({
        totalEvents: eventsCount || 0,
        totalExposants: exposantsCount || 0,
        upcomingEvents: upcomingCount || 0,
        lastEvent: lastEventData?.[0] || null
      });
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

  const loadQualityIssues = async () => {
    try {
      // Événements sans exposants
      const { data: eventsWithoutExposants } = await supabase
        .from('events_import')
        .select('id, nom_event')
        .not('id', 'in', '(SELECT DISTINCT id_event FROM exposants)');

      // Événements sans URL officielle
      const { data: eventsWithoutUrl } = await supabase
        .from('events_import')
        .select('id, nom_event')
        .or('url_site_officiel.is.null,url_site_officiel.eq.');

      // Événements sans image
      const { data: eventsWithoutImage } = await supabase
        .from('events_import')
        .select('id, nom_event')
        .or('url_image.is.null,url_image.eq.');

      setQualityIssues({
        eventsWithoutExposants: eventsWithoutExposants || [],
        eventsWithoutUrl: eventsWithoutUrl || [],
        eventsWithoutImage: eventsWithoutImage || []
      });
    } catch (error) {
      console.error('Erreur lors du chargement des problèmes de qualité:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const exportEventsToCsv = async () => {
    try {
      const { data } = await supabase
        .from('events_import')
        .select('*');

      if (!data) return;

      const csvContent = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'evenements_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export des événements:', error);
    }
  };

  const exportExposantsToCsv = async () => {
    try {
      const { data } = await supabase
        .from('exposants')
        .select('*');

      if (!data) return;

      const csvContent = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'exposants_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export des exposants:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-600">Accès refusé</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Cette page est réservée à l'administrateur.
            </p>
            <p className="text-sm text-gray-500">
              Connecté en tant que: {user?.email}
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Administration SalonsPro
          </h1>
          <p className="text-gray-600">
            Panneau de contrôle pour la gestion des données
          </p>
        </div>

        {/* Bloc Sécurité */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Sécurité et statut admin
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Email de l'utilisateur connecté :</p>
              <p className="font-semibold">{user?.email}</p>
              <Badge className="mt-2 bg-green-100 text-green-800">
                Vous êtes connecté en tant qu'administrateur
              </Badge>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>

        {/* Bloc Import Google Sheets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Import de données Google Sheets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoogleSheetsImporter />
          </CardContent>
        </Card>

        {/* Bloc Statistiques */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Statistiques rapides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{stats.totalEvents}</p>
                <p className="text-sm text-gray-600">Événements totaux</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Building className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{stats.totalExposants}</p>
                <p className="text-sm text-gray-600">Exposants totaux</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Users className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{stats.upcomingEvents}</p>
                <p className="text-sm text-gray-600">Événements à venir</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <ExternalLink className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div>
                  <p className="text-sm font-semibold text-purple-600">
                    Dernier import
                  </p>
                  <p className="text-xs text-gray-600">
                    {stats.lastEvent?.nom_event || 'Aucun'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloc Contrôle qualité */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Contrôle qualité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-red-600 mb-2">
                Événements sans exposants ({qualityIssues.eventsWithoutExposants.length})
              </h4>
              <div className="max-h-32 overflow-y-auto">
                {qualityIssues.eventsWithoutExposants.map((event: any) => (
                  <p key={event.id} className="text-sm text-gray-600 py-1">
                    • {event.nom_event}
                  </p>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-semibold text-orange-600 mb-2">
                Événements sans URL officielle ({qualityIssues.eventsWithoutUrl.length})
              </h4>
              <div className="max-h-32 overflow-y-auto">
                {qualityIssues.eventsWithoutUrl.map((event: any) => (
                  <p key={event.id} className="text-sm text-gray-600 py-1">
                    • {event.nom_event}
                  </p>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">
                Événements sans image ({qualityIssues.eventsWithoutImage.length})
              </h4>
              <div className="max-h-32 overflow-y-auto">
                {qualityIssues.eventsWithoutImage.map((event: any) => (
                  <p key={event.id} className="text-sm text-gray-600 py-1">
                    • {event.nom_event}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloc Outils Admin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-600" />
              Outils Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={exportEventsToCsv}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exporter tous les événements en CSV
              </Button>
              <Button
                onClick={exportExposantsToCsv}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exporter tous les exposants en CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;