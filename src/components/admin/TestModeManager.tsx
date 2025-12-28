import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Calendar, Sparkles, Building2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TestableItem {
  id: string;
  name: string;
  is_test: boolean;
  extra?: string;
}

type ContentType = 'events' | 'novelties' | 'exhibitors';

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
          query = supabase
            .from('events')
            .select('id, nom_event, is_test, date_debut')
            .order('date_debut', { ascending: false })
            .limit(50);
          break;
        case 'novelties':
          query = supabase
            .from('novelties')
            .select('id, title, is_test, status')
            .order('created_at', { ascending: false })
            .limit(50);
          break;
        case 'exhibitors':
          query = supabase
            .from('exhibitors')
            .select('id, name, is_test, approved')
            .order('created_at', { ascending: false })
            .limit(50);
          break;
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const mapped: TestableItem[] = (data || []).map((item: any) => ({
        id: item.id,
        name: type === 'events' ? item.nom_event : type === 'novelties' ? item.title : item.name,
        is_test: item.is_test ?? false,
        extra: type === 'events' 
          ? item.date_debut 
          : type === 'novelties' 
            ? item.status 
            : item.approved ? 'Approuvé' : 'Non approuvé'
      }));

      setItems(mapped);
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive'
      });
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
      const table = activeTab;
      const { error } = await supabase
        .from(table)
        .update({ is_test: !currentValue })
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_test: !currentValue } : item
      ));

      toast({
        title: !currentValue ? 'Mode test activé' : 'Mode test désactivé',
        description: !currentValue 
          ? 'Ce contenu est maintenant invisible pour les visiteurs' 
          : 'Ce contenu est maintenant visible publiquement'
      });
    } catch (error) {
      console.error('Erreur toggle:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le mode test',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const testCount = items.filter(i => i.is_test).length;
  const publicCount = items.filter(i => !i.is_test).length;

  const getIcon = (type: ContentType) => {
    switch (type) {
      case 'events': return <Calendar className="h-4 w-4" />;
      case 'novelties': return <Sparkles className="h-4 w-4" />;
      case 'exhibitors': return <Building2 className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-600" />
          <CardTitle>Gestion du Mode Test</CardTitle>
        </div>
        <CardDescription>
          Les contenus en mode test sont invisibles pour les visiteurs mais visibles par les admins.
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

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchItems(activeTab)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          {/* Compteurs */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">Public:</span>
              <Badge variant="secondary">{publicCount}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <EyeOff className="h-4 w-4 text-purple-600" />
              <span className="text-muted-foreground">Test:</span>
              <Badge variant="outline" className="border-purple-300 text-purple-700">{testCount}</Badge>
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
                        item.is_test ? 'bg-purple-50/50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getIcon(activeTab)}
                          <span className="font-medium truncate">{item.name || 'Sans nom'}</span>
                          {item.is_test && (
                            <Badge variant="outline" className="border-purple-300 text-purple-700 text-xs">
                              TEST
                            </Badge>
                          )}
                        </div>
                        {item.extra && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.extra}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-xs text-muted-foreground">
                          {item.is_test ? 'Invisible' : 'Visible'}
                        </span>
                        <Switch
                          checked={item.is_test}
                          onCheckedChange={() => toggleTestMode(item.id, item.is_test)}
                          disabled={updating === item.id}
                          className="data-[state=checked]:bg-purple-600"
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
