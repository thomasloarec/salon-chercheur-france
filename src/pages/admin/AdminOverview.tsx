import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Search, Sparkles, Building2 } from 'lucide-react';

const AdminOverview = () => {
  const { data: iaUses7d } = useQuery({
    queryKey: ['ia-visite-7d-widget'],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { count, error } = await supabase
        .from('wizard_sessions' as any)
        .select('*', { count: 'exact', head: true })
        .in('step_reached', ['results', 'saved'])
        .gte('created_at', since.toISOString());
      if (error) return 0;
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-muted-foreground">Gestion des événements, nouveautés et modération</p>
      </div>

      {/* Liens rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Blog SEO</h3>
                <p className="text-sm text-muted-foreground">Gérer les articles du blog</p>
              </div>
              <Button asChild>
                <Link to="/admin/blog">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Blog
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Audit SEO</h3>
                <p className="text-sm text-muted-foreground">Monitoring SEO complet</p>
              </div>
              <Button asChild>
                <Link to="/admin/seo-audit">
                  <Search className="h-4 w-4 mr-2" />
                  Dashboard SEO
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">IA Visite</h3>
                <p className="text-sm text-muted-foreground">Tracking "Préparer ma visite avec l'IA"</p>
                <p className="text-2xl font-bold mt-2">
                  {iaUses7d ?? '–'}{' '}
                  <span className="text-sm font-normal text-muted-foreground">utilisations (7j)</span>
                </p>
              </div>
              <Button asChild>
                <Link to="/admin/ia-visite">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Dashboard IA
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Exposants</h3>
                <p className="text-sm text-muted-foreground">Entreprises & gouvernance</p>
              </div>
              <Button asChild>
                <Link to="/admin/exhibitors">
                  <Building2 className="h-4 w-4 mr-2" />
                  Gérer
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques rapides */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Statistiques rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">0</div>
            <div className="text-sm text-gray-600">Événements publiés ce mois</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">0</div>
            <div className="text-sm text-gray-600">Événements en attente</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">0</div>
            <div className="text-sm text-gray-600">Total événements visibles</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
