import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Loader2, ExternalLink, Users, Calendar, FileWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types
interface ImportError {
  id: string;
  import_session_id: string;
  entity_type: 'event' | 'exposant' | 'participation';
  airtable_record_id: string;
  error_category: string;
  error_reason: string;
  context_data: Record<string, any>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface ErrorCategory {
  category: string;
  label: string;
  description: string;
  count: number;
  resolvedCount: number;
}

// Mapping des catégories pour affichage
const categoryLabels: Record<string, { label: string; description: string }> = {
  missing_name: { 
    label: 'Nom manquant', 
    description: 'Le champ nom_exposant est vide dans Airtable' 
  },
  missing_id: { 
    label: 'ID manquant', 
    description: 'Le champ id_exposant est vide dans Airtable' 
  },
  missing_website: { 
    label: 'Site web manquant', 
    description: 'Aucun site web renseigné pour faire le lien exposant/participation' 
  },
  exhibitor_not_found: { 
    label: 'Exposant introuvable', 
    description: 'Le site web ne correspond à aucun exposant dans la base' 
  },
  event_not_found: { 
    label: 'Événement introuvable', 
    description: "L'ID événement référencé n'existe pas dans la base" 
  },
  sync_error: { 
    label: 'Erreur de synchronisation', 
    description: 'Erreur lors de la synchronisation des données' 
  },
  batch_error: { 
    label: 'Erreur de lot', 
    description: "Erreur lors de l'insertion en base de données" 
  },
  other: { 
    label: 'Autre erreur', 
    description: 'Erreur non catégorisée' 
  }
};

// Icônes par type d'entité
const entityIcons: Record<string, React.ReactNode> = {
  event: <Calendar className="h-4 w-4" />,
  exposant: <Users className="h-4 w-4" />,
  participation: <FileWarning className="h-4 w-4" />
};

const entityLabels: Record<string, string> = {
  event: 'Événement',
  exposant: 'Exposant',
  participation: 'Participation'
};

export function ImportErrorsPanel() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch errors
  const { data: errors, isLoading, error: fetchError } = useQuery({
    queryKey: ['import-errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_errors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ImportError[];
    }
  });

  // Toggle resolved mutation
  const toggleResolved = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase
        .from('import_errors')
        .update({ 
          resolved, 
          resolved_at: resolved ? new Date().toISOString() : null 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-errors'] });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut',
        variant: 'destructive'
      });
      console.error('Toggle error:', error);
    }
  });

  // Grouper par catégorie
  const categorizedErrors = React.useMemo(() => {
    if (!errors) return [];
    
    const categoryMap = new Map<string, ErrorCategory>();
    
    errors.forEach(error => {
      const existing = categoryMap.get(error.error_category);
      if (existing) {
        existing.count++;
        if (error.resolved) existing.resolvedCount++;
      } else {
        const catInfo = categoryLabels[error.error_category] || categoryLabels.other;
        categoryMap.set(error.error_category, {
          category: error.error_category,
          label: catInfo.label,
          description: catInfo.description,
          count: 1,
          resolvedCount: error.resolved ? 1 : 0
        });
      }
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
  }, [errors]);

  // Stats globales
  const stats = React.useMemo(() => {
    if (!errors) return { total: 0, resolved: 0, pending: 0 };
    const resolved = errors.filter(e => e.resolved).length;
    return {
      total: errors.length,
      resolved,
      pending: errors.length - resolved
    };
  }, [errors]);

  // Filtrer par catégorie sélectionnée
  const filteredErrors = React.useMemo(() => {
    if (!errors) return [];
    if (!selectedCategory) return errors;
    return errors.filter(e => e.error_category === selectedCategory);
  }, [errors, selectedCategory]);

  // Grouper les erreurs filtrées par type d'entité
  const errorsByEntity = React.useMemo(() => {
    const groups: Record<string, ImportError[]> = {
      event: [],
      exposant: [],
      participation: []
    };
    
    filteredErrors.forEach(error => {
      groups[error.entity_type]?.push(error);
    });
    
    return groups;
  }, [filteredErrors]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Erreur lors du chargement des erreurs d'import
        </CardContent>
      </Card>
    );
  }

  if (!errors || errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            Aucune erreur d'import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Toutes les données ont été importées correctement lors du dernier import.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            Erreurs à corriger
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              {stats.pending} en attente
            </Badge>
            {stats.resolved > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {stats.resolved} résolues
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              sur {stats.total} total
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé par catégorie */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categorizedErrors.map(cat => (
            <div 
              key={cat.category} 
              className="bg-white rounded-lg border p-3 cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                setSelectedCategory(cat.category);
                setIsDialogOpen(true);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{cat.label}</span>
                <Badge variant="outline" className="text-xs">
                  {cat.resolvedCount}/{cat.count}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {cat.count - cat.resolvedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {cat.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bouton pour voir tous les détails */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setSelectedCategory(null)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Voir toutes les erreurs ({stats.total})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Détails des erreurs d'import
                {selectedCategory && (
                  <Badge variant="secondary" className="ml-2">
                    {categoryLabels[selectedCategory]?.label || selectedCategory}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {/* Filtres par catégorie */}
            <div className="flex flex-wrap gap-2 py-2 border-b">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Toutes ({stats.total})
              </Button>
              {categorizedErrors.map(cat => (
                <Button
                  key={cat.category}
                  variant={selectedCategory === cat.category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.category)}
                >
                  {cat.label} ({cat.count - cat.resolvedCount})
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Groupe par type d'entité */}
                {Object.entries(errorsByEntity).map(([entityType, entityErrors]) => {
                  if (entityErrors.length === 0) return null;
                  
                  return (
                    <div key={entityType}>
                      <h4 className="font-medium flex items-center gap-2 mb-3 text-muted-foreground">
                        {entityIcons[entityType]}
                        {entityLabels[entityType]}s ({entityErrors.length})
                      </h4>
                      
                      <div className="space-y-2">
                        {entityErrors.map(error => (
                          <ErrorRow 
                            key={error.id} 
                            error={error} 
                            onToggle={(resolved) => toggleResolved.mutate({ id: error.id, resolved })}
                            isPending={toggleResolved.isPending}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Composant pour une ligne d'erreur
function ErrorRow({ 
  error, 
  onToggle, 
  isPending 
}: { 
  error: ImportError; 
  onToggle: (resolved: boolean) => void;
  isPending: boolean;
}) {
  // Formater la raison de manière plus lisible
  const formatReason = (error: ImportError): string => {
    const { error_reason, context_data } = error;
    
    if (error.error_category === 'exhibitor_not_found' && context_data?.website) {
      return `Le site web "${context_data.website}" n'est pas associé à un exposant dans la base. Vérifiez l'orthographe ou ajoutez cet exposant.`;
    }
    
    if (error.error_category === 'missing_website') {
      return `Aucun site web renseigné pour cette participation. Impossible de faire le lien avec un exposant.`;
    }
    
    if (error.error_category === 'missing_name') {
      return `Le champ "nom_exposant" est vide dans Airtable pour cet enregistrement.`;
    }
    
    if (error.error_category === 'event_not_found' && context_data?.event_id) {
      return `L'événement "${context_data.event_id}" référencé n'existe pas dans la base.`;
    }
    
    return error_reason;
  };

  return (
    <div 
      className={`
        flex items-start gap-3 p-3 rounded-lg border transition-colors
        ${error.resolved 
          ? 'bg-green-50 border-green-200 opacity-60' 
          : 'bg-white border-gray-200 hover:border-gray-300'
        }
      `}
    >
      <Checkbox
        checked={error.resolved}
        onCheckedChange={(checked) => onToggle(checked as boolean)}
        disabled={isPending}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {entityLabels[error.entity_type]}
          </Badge>
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
            {error.airtable_record_id}
          </code>
          <a
            href={`https://airtable.com/${error.airtable_record_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          >
            <ExternalLink className="h-3 w-3" />
            Airtable
          </a>
        </div>
        
        <p className={`text-sm ${error.resolved ? 'line-through text-muted-foreground' : ''}`}>
          {formatReason(error)}
        </p>
        
        {error.context_data?.website && (
          <p className="text-xs text-muted-foreground mt-1">
            Site: <code className="bg-gray-100 px-1 rounded">{error.context_data.website}</code>
          </p>
        )}
      </div>
      
      {error.resolved && error.resolved_at && (
        <span className="text-xs text-green-600 whitespace-nowrap">
          ✓ Résolu
        </span>
      )}
    </div>
  );
}
