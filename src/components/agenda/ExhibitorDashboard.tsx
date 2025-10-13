import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Eye, Edit, MapPin, Calendar, Users, Heart, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ExhibitorLeadsPanel from '@/components/agenda/ExhibitorLeadsPanel';
import NoveltyLeadsDisplay from '@/components/novelty/NoveltyLeadsDisplay';
import { EditNoveltyDialog } from '@/components/novelty/EditNoveltyDialog';
import type { MyNovelty } from '@/hooks/useMyNovelties';

const NOVELTY_TYPE_LABELS = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre spéciale',
  Talk: 'Conférence'
};

interface ExhibitorDashboardProps {
  exhibitors: any[];
  novelties: MyNovelty[];
  isLoading?: boolean;
}

export function ExhibitorDashboard({ exhibitors, novelties, isLoading }: ExhibitorDashboardProps) {
  const [editingNovelty, setEditingNovelty] = useState<MyNovelty | null>(null);

  const handleEdit = (novelty: MyNovelty) => {
    setEditingNovelty(novelty);
  };

  // Calculer les statistiques globales
  const totalLikes = novelties.reduce((sum, n) => sum + (n.stats?.likes || 0), 0);
  const totalLeads = novelties.reduce((sum, n) => sum + (n.stats?.total_leads || 0), 0);
  const publishedNovelties = novelties.filter(n => n.status === 'published').length;

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="overflow-hidden animate-pulse">
            <div className="aspect-video bg-gray-200"></div>
            <CardContent className="p-6">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner explicatif */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">
              Espace Exposant
            </h3>
            <p className="text-sm text-green-700">
              Gérez vos nouveautés publiées, consultez vos statistiques et suivez vos leads générés sur les salons.
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nouveautés publiées</p>
                <p className="text-2xl font-bold">{publishedNovelties}</p>
              </div>
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total nouveautés</p>
                <p className="text-2xl font-bold">{novelties.length}</p>
              </div>
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Likes totaux</p>
                <p className="text-2xl font-bold">{totalLikes}</p>
              </div>
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads générés</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Panel si exposant */}
      {exhibitors.length > 0 && (
        <div className="mb-6">
          <ExhibitorLeadsPanel exhibitors={exhibitors} />
        </div>
      )}

      {/* Liste des nouveautés */}
      {novelties.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Mes nouveautés</h2>
            <Button asChild>
              <Link to="/events">
                <Sparkles className="h-4 w-4 mr-2" />
                Créer une nouveauté
              </Link>
            </Button>
          </div>

          {novelties.map((novelty) => (
            <Card key={novelty.id} className="overflow-hidden">
              {/* Header avec actions */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">{novelty.title}</h2>
                    <Badge 
                      variant={novelty.status === 'published' ? 'default' : 'secondary'}
                    >
                      {novelty.status === 'published' ? 'Publié' : 
                       novelty.status === 'draft' ? 'En attente' : novelty.status}
                    </Badge>
                    <Badge variant="outline">
                      {NOVELTY_TYPE_LABELS[novelty.type as keyof typeof NOVELTY_TYPE_LABELS] || novelty.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {novelty.exhibitors.name}
                    </div>
                    <span>•</span>
                    <Link 
                      to={`/events/${novelty.events.slug}`} 
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <MapPin className="h-4 w-4" />
                      {novelty.events.nom_event}
                    </Link>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(novelty.events.date_debut), 'dd MMM', { locale: fr })}
                      {novelty.events.date_fin !== novelty.events.date_debut && 
                        ` - ${format(new Date(novelty.events.date_fin), 'dd MMM yyyy', { locale: fr })}`
                      }
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" asChild size="sm">
                    <Link to={`/events/${novelty.events.slug}#nouveautes`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Voir sur le salon
                    </Link>
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleEdit(novelty)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                </div>
              </div>
              
              {/* Body: Image + Stats */}
              <div className="grid md:grid-cols-[300px,1fr] gap-6 p-6">
                {/* Image principale */}
                {novelty.media_urls && novelty.media_urls[0] && (
                  <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={novelty.media_urls[0]}
                      alt={novelty.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                
                {/* Stats + Description */}
                <div className="space-y-4">
                  {/* Stats compactes */}
                  <div className="flex items-center gap-6">
                    {/* Likes */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <Heart className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{novelty.stats?.likes || 0}</p>
                        <p className="text-xs text-muted-foreground">Likes</p>
                      </div>
                    </div>
                    
                    {/* Leads total */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{novelty.stats?.total_leads || 0}</p>
                        <p className="text-xs text-muted-foreground">Leads</p>
                      </div>
                    </div>
                  </div>
                  
                  {novelty.reason_1 && (
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {novelty.reason_1}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Section Leads */}
              <div className="p-6 border-t bg-muted/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Leads
                </h3>
                <NoveltyLeadsDisplay 
                  noveltyId={novelty.id} 
                  isPremium={novelty.is_premium || false}
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg">
          <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Aucune nouveauté créée
          </h3>
          <p className="text-gray-500 mb-6">
            Publiez vos innovations sur les salons pour attirer plus de visiteurs
          </p>
          <Button asChild>
            <Link to="/events">Découvrir les salons</Link>
          </Button>
        </div>
      )}

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
