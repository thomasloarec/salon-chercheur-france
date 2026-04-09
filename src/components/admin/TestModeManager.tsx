import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Sparkles, Building2, RefreshCw, Eye, EyeOff, HelpCircle, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestableItem {
  id: string;
  name: string;
  is_test: boolean;
  extra?: string;
}

type ContentType = 'events' | 'novelties' | 'exhibitors';

const EXPLANATIONS: Record<ContentType, { title: string; description: string; impact: string }> = {
  events: {
    title: 'Événements',
    description: 'Le champ is_test contrôle si un événement est une donnée de test interne.',
    impact: 'Les événements marqués "test" sont exclus de la liste publique du site, de la carte, de la recherche et du SEO. Ils restent visibles uniquement pour les admins.',
  },
  novelties: {
    title: 'Nouveautés',
    description: 'Le champ is_test contrôle si une nouveauté est une donnée de test.',
    impact: 'Les nouveautés "test" ne sont pas affichées sur les pages événements ni dans la section Nouveautés publique.',
  },
  exhibitors: {
    title: 'Exposants',
    description: 'Le champ is_test contrôle si un exposant est une donnée de test.',
    impact: 'Les exposants "test" ne sont pas affichés dans les listes d\'exposants sur les pages événements.',
  },
};

const TestModeManager = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ContentType>('events');
  const [items, setItems] = useState<TestableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchItems = async (type: ContentType) => {
    setLoading(true);
    try {
      let query;
      switch (type) {
        case 'events':
          query = supabase.from('events').select('id, nom_event, is_test, date_debut').order('date_debut', { ascending: false }).limit(50);
          break;
        case 'novelties':
          query = supabase.from('novelties').select('id, title, is_test, status').order('created_at', { ascending: false }).limit(50);
          break;
        case 'exhibitors':
          query = supabase.from('exhibitors').select('id, name, is_test, approved').order('created_at', { ascending: false }).limit(50);
          break;
      }
      const { data, error } = await query;
      if (error) throw error;

      const mapped: TestableItem[] = (data || []).map((item: any) => ({
        id: item.id,
        name: type === 'events' ? item.nom_event : type === 'novelties' ? item.title : item.name,
        is_test: item.is_test ?? false,
        extra: type === 'events'
          ? (item.date_debut ? new Date(item.date_debut).toLocaleDateString('fr-FR') : 'Sans date')
          : type === 'novelties'
            ? `Statut : ${item.status || '—'}`
            : item.approved ? 'Approuvé' : 'Non approuvé',
      }));
      setItems(mapped);
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(activeTab);
  }, [activeTab]);

  const toggleTestMode = async (id: string, currentValue: boolean) => {
    setUpdating(id);
    try {
      const { error } = await supabase.from(activeTab).update({ is_test: !currentValue }).eq('id', id);
      if (error) throw error;
      setItems(prev => prev.map(item => item.id === id ? { ...item, is_test: !currentValue } : item));
      toast({
        title: !currentValue ? '⚗️ Marqué comme donnée de test' : '✓ Remis en production',
        description: !currentValue
          ? 'Ce contenu est maintenant masqué pour les visiteurs publics'
          : 'Ce contenu est maintenant visible sur le site public',
      });
    } catch (error) {
      console.error('Erreur toggle:', error);
      toast({ title: 'Erreur', description: 'Impossible de modifier', variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const testCount = items.filter(i => i.is_test).length;
  const prodCount = items.filter(i => !i.is_test).length;
  const info = EXPLANATIONS[activeTab];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Données de test</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Le marquage "donnée de test" permet de masquer des contenus créés à des fins de test ou de démonstration, sans les supprimer.</p>
                <p className="mt-1">Les données de test sont <strong>invisibles sur le site public</strong> mais <strong>visibles par les admins</strong>.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Marquez des contenus comme "données de test" pour les masquer du site public sans les supprimer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentType)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="events" className="gap-2">
                <Calendar className="h-4 w-4" />
                Événements
              </TabsTrigger>
              <TabsTrigger value="novelties" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Nouveautés
              </TabsTrigger>
              <TabsTrigger value="exhibitors" className="gap-2">
                <Building2 className="h-4 w-4" />
                Exposants
              </TabsTrigger>
            </TabsList>

            <Button variant="outline" size="sm" onClick={() => fetchItems(activeTab)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          {/* Explanation banner */}
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{info.title}</strong> — {info.description}<br />
              <span className="text-muted-foreground">{info.impact}</span>
            </AlertDescription>
          </Alert>

          {/* Counters */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">En production :</span>
              <Badge variant="secondary">{prodCount}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Données de test :</span>
              <Badge variant="outline">{testCount}</Badge>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-[400px] rounded-md border">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  Aucun contenu trouvé
                </div>
              ) : (
                <div className="divide-y">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 hover:bg-muted/50 transition-colors ${
                        item.is_test ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.name || 'Sans nom'}</span>
                          {item.is_test && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              ⚗️ Test
                            </Badge>
                          )}
                        </div>
                        {item.extra && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.extra}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground cursor-help">
                                {item.is_test ? 'Masqué du site' : 'Visible sur le site'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {item.is_test
                                ? 'Ce contenu est masqué pour les visiteurs. Seuls les admins le voient.'
                                : 'Ce contenu est visible publiquement sur le site.'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Switch
                          checked={item.is_test}
                          onCheckedChange={() => toggleTestMode(item.id, item.is_test)}
                          disabled={updating === item.id}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TestModeManager;
