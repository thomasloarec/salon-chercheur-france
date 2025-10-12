import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EditNoveltyDialogProps {
  novelty: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NOVELTY_TYPES = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre spéciale',
  Talk: 'Conférence'
};

export const EditNoveltyDialog = ({ novelty, open, onOpenChange }: EditNoveltyDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: novelty.title,
    type: novelty.type,
    reason: novelty.reason_1 || '',
    images: [] as File[],
    existingImages: novelty.media_urls || [],
    brochure: null as File | null,
    existingBrochure: novelty.doc_url,
    stand_info: novelty.stand_info || '',
  });
  
  const queryClient = useQueryClient();

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${novelty.exhibitor_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('novelty-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('novelty-images')
        .getPublicUrl(filePath);

      urls.push(publicUrl);
    }

    return urls;
  };

  const uploadPDF = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${novelty.exhibitor_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('novelty-resources')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('novelty-resources')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      // Upload new images if present
      let imageUrls = formData.existingImages;
      if (formData.images.length > 0) {
        imageUrls = await uploadImages(formData.images);
      }

      // Upload new PDF if present
      let pdfUrl = formData.existingBrochure;
      if (formData.brochure) {
        pdfUrl = await uploadPDF(formData.brochure);
      }

      // Update in DB
      const { error } = await supabase
        .from('novelties')
        .update({
          title: formData.title,
          type: formData.type,
          reason_1: formData.reason,
          media_urls: imageUrls,
          doc_url: pdfUrl,
          stand_info: formData.stand_info,
          status: 'draft', // Repasse en attente de validation
          updated_at: new Date().toISOString(),
        })
        .eq('id', novelty.id);

      if (error) throw error;

      toast.success('Nouveauté modifiée', {
        description: 'Vos modifications ont été enregistrées et seront validées par notre équipe.',
      });

      queryClient.invalidateQueries({ queryKey: ['my-novelties'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating novelty:', error);
      toast.error('Erreur', {
        description: 'Impossible de modifier la nouveauté.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la nouveauté</DialogTitle>
          <p className="text-sm text-muted-foreground">
            ⚠️ Toute modification nécessitera une nouvelle validation
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Titre</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <Label>Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NOVELTY_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={5}
              placeholder="Décrivez votre nouveauté..."
            />
          </div>

          <div>
            <Label>Informations stand (optionnel)</Label>
            <Input
              value={formData.stand_info}
              onChange={(e) => setFormData({ ...formData, stand_info: e.target.value })}
              placeholder="Ex: Hall 3, Stand A45"
            />
          </div>

          <div>
            <Label>Images actuelles</Label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {formData.existingImages.map((url, idx) => (
                <img 
                  key={idx} 
                  src={url} 
                  alt="" 
                  className="w-full h-24 object-contain rounded border" 
                />
              ))}
            </div>
            <Label>Remplacer par de nouvelles images (optionnel)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFormData({ ...formData, images: Array.from(e.target.files || []) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum 3 images. Les nouvelles images remplaceront les anciennes.
            </p>
          </div>

          <div>
            <Label>Brochure PDF (optionnel)</Label>
            {formData.existingBrochure && (
              <p className="text-sm text-muted-foreground mb-2">
                ✅ Brochure existante
              </p>
            )}
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => setFormData({ ...formData, brochure: e.target.files?.[0] || null })}
            />
          </div>

          <Button 
            onClick={handleUpdate} 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer les modifications'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
