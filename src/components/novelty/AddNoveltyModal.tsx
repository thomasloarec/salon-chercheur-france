import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { X, Plus, Loader2 } from 'lucide-react';
import { useCreateNovelty } from '@/hooks/useNovelties';
import { useNoveltyQuota } from '@/hooks/useNoveltyQuota';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NoveltyLimitDialog } from './NoveltyLimitDialog';
import type { Event } from '@/types/event';
import type { 
  Exhibitor, 
  AddNoveltyFormData, 
  NoveltyType 
} from '@/types/lotexpo';
import { NOVELTY_TYPES, MAX_NOVELTY_IMAGES } from '@/types/lotexpo';

interface AddNoveltyModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

interface DbExhibitor {
  id: string;
  name: string;
  plan: string;
  slug?: string | null;
  logo_url?: string | null;
  owner_user_id?: string | null;
  description?: string | null;
  website?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DbParticipation {
  id_exposant: string;
  stand_exposant?: string | null;
}

export default function AddNoveltyModal({ event, isOpen, onClose }: AddNoveltyModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createNovelty = useCreateNovelty();
  const { data: profileCheck, isLoading: isLoadingProfile } = useProfileComplete();

  const [userExhibitors, setUserExhibitors] = useState<Exhibitor[]>([]);
  const [participationData, setParticipationData] = useState<DbParticipation[]>([]);
  const [loadingExhibitors, setLoadingExhibitors] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [formData, setFormData] = useState<AddNoveltyFormData>({
    exhibitor_id: '',
    title: '',
    type: 'Launch',
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
  const [newTag, setNewTag] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');

  // Vérifier le quota de nouveautés
  const { data: quota } = useNoveltyQuota(
    formData.exhibitor_id || undefined,
    event.id
  );

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
        type: 'Launch',
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
        .select('id, name, plan, slug, logo_url, owner_user_id, description, website, created_at, updated_at');

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
      const { data: participationData, error: participationError } = await supabase
        .from('participation')
        .select('id_exposant, stand_exposant')
        .eq('id_event', event.id)
        .in('id_exposant', exhibitorIds);

      if (participationError) {
        console.error('Error fetching participation:', participationError);
      }

      setParticipationData(participationData || []);

      // Filter exhibitors to only those participating and convert to Exhibitor type
      const participatingExhibitors: Exhibitor[] = exhibitorsData
        .filter(exhibitor => {
          const participation = participationData?.find(p => p.id_exposant === exhibitor.id);
          return !!participation;
        })
        .map(exhibitor => ({
          id: exhibitor.id,
          name: exhibitor.name,
          plan: (exhibitor.plan === 'paid' ? 'paid' : 'free') as 'free' | 'paid',
          slug: exhibitor.slug,
          logo_url: exhibitor.logo_url,
          owner_user_id: exhibitor.owner_user_id,
          description: exhibitor.description,
          website: exhibitor.website,
          created_at: exhibitor.created_at,
          updated_at: exhibitor.updated_at
        }));

      setUserExhibitors(participatingExhibitors);

      // Pre-fill if only one exhibitor
      if (participatingExhibitors.length === 1) {
        const exhibitor = participatingExhibitors[0];
        const participation = participationData?.find(p => p.id_exposant === exhibitor.id);
        const standInfo = participation?.stand_exposant || '';
        
        setFormData(prev => ({
          ...prev,
          exhibitor_id: exhibitor.id,
          stand_info: standInfo
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

    // Vérifier le quota AVANT de créer
    if (quota && !quota.allowed) {
      setShowLimitDialog(true);
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
        type: formData.type,
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

      // ✅ Clean success handling - no additional operations
      toast({
        title: '✅ Nouveauté créée !',
        description: 'Votre nouveauté a été soumise avec succès.',
      });

      // ✅ Close modal - queries will be invalidated by the mutation hook
      onClose();
    } catch (error) {
      console.error('Error creating novelty:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer la nouveauté',
        variant: 'destructive',
      });
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
    if (newMediaUrl.trim() && formData.media_urls.length < MAX_NOVELTY_IMAGES) {
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
    <>
      <NoveltyLimitDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        currentCount={quota?.current || 0}
        limit={quota?.limit || 1}
        eventName={event.nom_event}
      />

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une nouveauté</DialogTitle>
          </DialogHeader>

          {/* Profile Completeness Check */}
          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !profileCheck?.isComplete ? (
            <div className="space-y-4">
              <div className="p-4 border border-destructive bg-destructive/10 rounded-lg">
                <h3 className="font-semibold text-destructive mb-2">
                  Profil incomplet
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Vous devez compléter votre profil à 100% avant de pouvoir publier une nouveauté.
                </p>
                <p className="text-sm font-medium mb-2">Champs manquants :</p>
                <ul className="list-disc list-inside text-sm space-y-1 mb-4">
                  {profileCheck?.missingFields.map((field, index) => (
                    <li key={index}>{field}</li>
                  ))}
                </ul>
                <Link to="/profile">
                  <Button type="button" variant="default" className="w-full">
                    Compléter mon profil
                  </Button>
                </Link>
              </div>
              <Button type="button" variant="outline" onClick={onClose} className="w-full">
                Fermer
              </Button>
            </div>
          ) : (
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
              <SafeSelect
                ariaLabel="Sélection exposant"
                placeholder="Sélectionnez un exposant"
                value={formData.exhibitor_id}
                onChange={(value) => {
                  if (!value) return;
                  const participation = participationData.find(p => p.id_exposant === value);
                  const standInfo = participation?.stand_exposant || '';
                  
                  setFormData(prev => ({
                    ...prev,
                    exhibitor_id: value,
                    stand_info: standInfo
                  }));
                }}
                options={userExhibitors.map(exhibitor => ({
                  value: exhibitor.id,
                  label: `${exhibitor.name}${exhibitor.plan === 'free' ? ' (Gratuit)' : ''}`
                }))}
                includeAllOption={false}
              />
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
            <SafeSelect
              ariaLabel="Type de nouveauté"
              placeholder="Sélectionnez un type"
              value={formData.type}
              onChange={(value: string | null) => {
                if (value) {
                  setFormData(prev => ({ ...prev, type: value as NoveltyType }));
                }
              }}
              options={NOVELTY_TYPES.map(type => ({ value: type.value, label: type.label }))}
              includeAllOption={false}
            />
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
            <Label>Images (max {MAX_NOVELTY_IMAGES})</Label>
            <div className="flex gap-2">
              <Input
                value={newMediaUrl}
                onChange={(e) => setNewMediaUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMediaUrl())}
                disabled={formData.media_urls.length >= MAX_NOVELTY_IMAGES}
              />
              <Button 
                type="button" 
                onClick={addMediaUrl} 
                size="sm"
                disabled={formData.media_urls.length >= MAX_NOVELTY_IMAGES}
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}