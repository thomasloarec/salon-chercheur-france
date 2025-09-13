import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2 } from 'lucide-react';
import { useCreateNovelty } from '@/hooks/useNovelties';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Event } from '@/types/event';

interface Exhibitor {
  id: string;
  name: string;
  plan: string;
  stand_info: string;
}

interface AddNoveltyModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

const NOVELTY_TYPES = [
  { value: 'Launch', label: 'Lancement' },
  { value: 'Prototype', label: 'Prototype' },
  { value: 'MajorUpdate', label: 'Mise à jour majeure' },
  { value: 'LiveDemo', label: 'Démo live' },
  { value: 'Partnership', label: 'Partenariat' },
  { value: 'Offer', label: 'Offre spéciale' },
  { value: 'Talk', label: 'Conférence' },
];

export default function AddNoveltyModal({ event, isOpen, onClose }: AddNoveltyModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createNovelty = useCreateNovelty();

  const [userExhibitors, setUserExhibitors] = useState<Exhibitor[]>([]);
  const [loadingExhibitors, setLoadingExhibitors] = useState(false);
  const [formData, setFormData] = useState({
    exhibitor_id: '',
    title: '',
    type: '',
    reason_1: '',
    reason_2: '',
    reason_3: '',
    audience_tags: [] as string[],
    media_urls: [] as string[],
    doc_url: '',
    availability: '',
    stand_info: '',
    demo_slots: null as any
  });
  const [newTag, setNewTag] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');

  // Fetch user's exhibitors when modal opens
  useEffect(() => {
    if (isOpen && user) {
      fetchUserExhibitors();
    }
  }, [isOpen, user]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        exhibitor_id: '',
        title: '',
        type: '',
        reason_1: '',
        reason_2: '',
        reason_3: '',
        audience_tags: [],
        media_urls: [],
        doc_url: '',
        availability: '',
        stand_info: '',
        demo_slots: null
      });
      setNewTag('');
      setNewMediaUrl('');
    }
  }, [isOpen]);

  const fetchUserExhibitors = async () => {
    if (!user) return;

    setLoadingExhibitors(true);
    try {
      // Check if user is admin first
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = profile?.role === 'admin';

      // Get exhibitors owned by the user (or all if admin)
      let exhibitorsQuery = supabase
        .from('exhibitors')
        .select('id, name, plan');

      if (!isAdmin) {
        exhibitorsQuery = exhibitorsQuery.eq('owner_user_id', user.id);
      }

      const { data: exhibitorsData, error: exhibitorsError } = await exhibitorsQuery;

      if (exhibitorsError) {
        console.error('Error fetching exhibitors:', exhibitorsError);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les exposants.',
          variant: 'destructive',
        });
        return;
      }

      if (!exhibitorsData || exhibitorsData.length === 0) {
        setUserExhibitors([]);
        return;
      }

      // Get participations for these exhibitors at this event
      const exhibitorIds = exhibitorsData.map(e => e.id);
      const { data: participationData } = await supabase
        .from('participation')
        .select('id_exposant, stand_exposant')
        .eq('id_event', event.id)
        .in('id_exposant', exhibitorIds);

      // Filter exhibitors to only those participating and add stand info
      const participatingExhibitors: Exhibitor[] = exhibitorsData
        .map(exhibitor => {
          const participation = participationData?.find(p => p.id_exposant === exhibitor.id);
          if (!participation) return null;
          
          return {
            ...exhibitor,
            stand_info: participation.stand_exposant || ''
          };
        })
        .filter((exhibitor): exhibitor is Exhibitor => exhibitor !== null);

      setUserExhibitors(participatingExhibitors);

      // Pre-fill if only one exhibitor
      if (participatingExhibitors.length === 1) {
        const exhibitor = participatingExhibitors[0];
        setFormData(prev => ({
          ...prev,
          exhibitor_id: exhibitor.id,
          stand_info: exhibitor.stand_info || ''
        }));
      }

    } catch (error) {
      console.error('Error fetching exhibitors:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue lors du chargement.',
        variant: 'destructive',
      });
    } finally {
      setLoadingExhibitors(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.exhibitor_id || !formData.title || !formData.type) {
      toast({
        title: 'Champs requis manquants',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    // Check URL validity
    const invalidUrls = formData.media_urls.filter(url => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      toast({
        title: 'URLs invalides',
        description: 'Certaines URLs d\'images ne sont pas valides.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createNovelty.mutateAsync({
        event_id: event.id,
        exhibitor_id: formData.exhibitor_id,
        title: formData.title,
        type: formData.type as any,
        reason_1: formData.reason_1 || undefined,
        reason_2: formData.reason_2 || undefined,
        reason_3: formData.reason_3 || undefined,
        audience_tags: formData.audience_tags.length > 0 ? formData.audience_tags : undefined,
        media_urls: formData.media_urls.length > 0 ? formData.media_urls : undefined,
        doc_url: formData.doc_url || undefined,
        availability: formData.availability || undefined,
        stand_info: formData.stand_info || undefined,
        demo_slots: formData.demo_slots || undefined
      });

      onClose();
    } catch (error) {
      // Error handled by the hook
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.audience_tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        audience_tags: [...prev.audience_tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      audience_tags: prev.audience_tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addMediaUrl = () => {
    if (newMediaUrl.trim() && formData.media_urls.length < 5) {
      try {
        new URL(newMediaUrl.trim()); // Validate URL
        setFormData(prev => ({
          ...prev,
          media_urls: [...prev.media_urls, newMediaUrl.trim()]
        }));
        setNewMediaUrl('');
      } catch {
        toast({
          title: 'URL invalide',
          description: 'Veuillez saisir une URL valide.',
          variant: 'destructive',
        });
      }
    }
  };

  const removeMediaUrl = (urlToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      media_urls: prev.media_urls.filter(url => url !== urlToRemove)
    }));
  };

  const selectedExhibitor = userExhibitors.find(e => e.id === formData.exhibitor_id);
  const isFreePlan = selectedExhibitor?.plan === 'free';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une nouveauté</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Exhibitor Selection */}
          <div className="space-y-2">
            <Label htmlFor="exhibitor">Exposant *</Label>
            {loadingExhibitors ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Chargement des exposants...</span>
              </div>
            ) : userExhibitors.length === 0 ? (
              <div className="p-4 border rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Aucun exposant participant trouvé. Vous devez être co-administrateur d'un exposant participant à cet événement.
                </p>
              </div>
            ) : (
              <Select
                value={formData.exhibitor_id}
                onValueChange={(value) => {
                  const exhibitor = userExhibitors.find(e => e.id === value);
                  setFormData(prev => ({
                    ...prev,
                    exhibitor_id: value,
                    stand_info: exhibitor?.stand_info || prev.stand_info
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un exposant" />
                </SelectTrigger>
                <SelectContent>
                  {userExhibitors.map((exhibitor) => (
                    <SelectItem key={exhibitor.id} value={exhibitor.id}>
                      {exhibitor.name}
                      {exhibitor.plan === 'free' && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Gratuit
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {isFreePlan && (
              <p className="text-sm text-amber-600">
                Plan gratuit : 1 nouveauté par événement. Passez en plan Pro pour en publier davantage.
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre de la nouveauté *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Nouveau logiciel de gestion innovant"
              required
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type de nouveauté *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                {NOVELTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reasons */}
          <div className="space-y-4">
            <Label>Pourquoi c'est intéressant ?</Label>
            
            <div className="space-y-2">
              <Label htmlFor="reason1" className="text-sm text-muted-foreground">Raison 1</Label>
              <Textarea
                id="reason1"
                value={formData.reason_1}
                onChange={(e) => setFormData(prev => ({ ...prev, reason_1: e.target.value }))}
                placeholder="Première raison pour laquelle cette nouveauté est intéressante"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason2" className="text-sm text-muted-foreground">Raison 2</Label>
              <Textarea
                id="reason2"
                value={formData.reason_2}
                onChange={(e) => setFormData(prev => ({ ...prev, reason_2: e.target.value }))}
                placeholder="Deuxième raison (optionnel)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason3" className="text-sm text-muted-foreground">Raison 3</Label>
              <Textarea
                id="reason3"
                value={formData.reason_3}
                onChange={(e) => setFormData(prev => ({ ...prev, reason_3: e.target.value }))}
                placeholder="Troisième raison (optionnel)"
                rows={2}
              />
            </div>
          </div>

          {/* Audience Tags */}
          <div className="space-y-2">
            <Label>Public cible</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Ex: PME, Startups, Industrie..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.audience_tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.audience_tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Media URLs */}
          <div className="space-y-2">
            <Label>Images (max 5)</Label>
            <div className="flex gap-2">
              <Input
                value={newMediaUrl}
                onChange={(e) => setNewMediaUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMediaUrl())}
                disabled={formData.media_urls.length >= 5}
              />
              <Button 
                type="button" 
                onClick={addMediaUrl} 
                size="sm"
                disabled={formData.media_urls.length >= 5}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.media_urls.length > 0 && (
              <div className="space-y-2">
                {formData.media_urls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    <span className="text-sm truncate flex-1">{url}</span>
                    <Button
                      type="button"
                      onClick={() => removeMediaUrl(url)}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc_url">Documentation (URL)</Label>
              <Input
                id="doc_url"
                value={formData.doc_url}
                onChange={(e) => setFormData(prev => ({ ...prev, doc_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability">Disponibilité</Label>
              <Input
                id="availability"
                value={formData.availability}
                onChange={(e) => setFormData(prev => ({ ...prev, availability: e.target.value }))}
                placeholder="Ex: Q2 2024, Disponible immédiatement..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stand_info">Informations du stand</Label>
            <Input
              id="stand_info"
              value={formData.stand_info}
              onChange={(e) => setFormData(prev => ({ ...prev, stand_info: e.target.value }))}
              placeholder="Ex: Hall A - Stand 123"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createNovelty.isPending || !formData.exhibitor_id || !formData.title || !formData.type || userExhibitors.length === 0}
            >
              {createNovelty.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Publier la nouveauté
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}