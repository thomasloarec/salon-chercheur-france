import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Eye, Edit, MapPin, Calendar, Sparkles, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ExhibitorLeadsPanel from '@/components/agenda/ExhibitorLeadsPanel';
import NoveltyLeadsDisplay from '@/components/novelty/NoveltyLeadsDisplay';
import { EditNoveltyDialog } from '@/components/novelty/EditNoveltyDialog';
import type { MyNovelty } from '@/hooks/useMyNovelties';

interface ExhibitorDashboardProps {
  exhibitors: any[];
  novelties: MyNovelty[];
}

export function ExhibitorDashboard({ exhibitors, novelties }: ExhibitorDashboardProps) {
  const [editingNovelty, setEditingNovelty] = useState<MyNovelty | null>(null);

  const handleEdit = (novelty: MyNovelty) => {
    setEditingNovelty(novelty);
  };

  return (
    <div className="space-y-6">
      {/* Banner explicatif */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">
              Espace professionnel exposant
            </h3>
            <p className="text-sm text-green-700">
              Gérez vos nouveautés, suivez vos statistiques et consultez vos leads générés sur les salons.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs pour organiser le contenu exposant */}
      <Tabs defaultValue="novelties" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="novelties" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Mes Nouveautés
            <Badge variant="secondary">{novelties.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Mes Entreprises
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* Tab Nouveautés */}
        <TabsContent value="novelties" className="space-y-6">
          {novelties.length > 0 ? (
            novelties.map((novelty) => (
              <Card key={novelty.id}>
                <CardContent className="p-6">
                  {/* Header avec statut */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{novelty.title}</h3>
                        <Badge variant={novelty.status === 'published' ? 'default' : 'secondary'}>
                          {novelty.status === 'published' ? 'Publié' : 'En attente'}
                        </Badge>
                        <Badge variant="outline">{novelty.type}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          {novelty.exhibitors.name}
                        </span>
                        <Link 
                          to={`/events/${novelty.events.slug}`}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <MapPin className="h-4 w-4" />
                          {novelty.events.nom_event}
                        </Link>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(novelty.events.date_debut), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/events/${novelty.events.slug}#nouveautes`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Voir
                        </Link>
                      </Button>
                      <Button size="sm" onClick={() => handleEdit(novelty)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                    </div>
                  </div>

                  {/* Statistiques en ligne */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{novelty.stats?.likes || 0}</p>
                      <p className="text-xs text-muted-foreground">Likes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{novelty.stats?.brochure_leads || 0}</p>
                      <p className="text-xs text-muted-foreground">Téléchargements</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{novelty.stats?.total_leads || 0}</p>
                      <p className="text-xs text-muted-foreground">Leads totaux</p>
                    </div>
                  </div>

                  {/* Section Leads compacte */}
                  {novelty.stats && novelty.stats.total_leads > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <NoveltyLeadsDisplay 
                        noveltyId={novelty.id}
                        isPremium={novelty.is_premium || false}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  Aucune nouveauté créée
                </h3>
                <p className="text-gray-500 mb-6">
                  Publiez vos innovations sur les salons pour attirer des visiteurs
                </p>
                <Button asChild>
                  <Link to="/events">Publier une nouveauté</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Entreprises */}
        <TabsContent value="companies">
          <ExhibitorLeadsPanel exhibitors={exhibitors} />
        </TabsContent>

        {/* Tab Statistiques */}
        <TabsContent value="analytics">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Statistiques globales</h3>
              <p className="text-muted-foreground">
                Statistiques détaillées à venir...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Novelty Dialog */}
      {editingNovelty && (
        <EditNoveltyDialog
          novelty={editingNovelty}
          open={!!editingNovelty}
          onOpenChange={(open) => !open && setEditingNovelty(null)}
        />
      )}
    </div>
  );
}
