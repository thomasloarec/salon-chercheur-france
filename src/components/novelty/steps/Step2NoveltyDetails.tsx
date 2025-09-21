import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImagesUploader from '../ImagesUploader';
import ResourceUploader from '../ResourceUploader';
import type { Step2Data } from '@/lib/validation/noveltySchemas';
import { NOVELTY_TYPES } from '@/lib/validation/noveltySchemas';

const NOVELTY_TYPE_LABELS: Record<typeof NOVELTY_TYPES[number], string> = {
  Launch: 'Lancement produit',
  Update: 'Mise à jour',
  Demo: 'Démonstration',
  Special_Offer: 'Offre spéciale',
  Partnership: 'Partenariat',
  Innovation: 'Innovation'
};

interface Step2NoveltyDetailsProps {
  data: Partial<Step2Data>;
  onChange: (data: Partial<Step2Data>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function Step2NoveltyDetails({
  data,
  onChange,
  onValidationChange
}: Step2NoveltyDetailsProps) {
  const [formData, setFormData] = useState({
    title: data.title || '',
    type: data.type || '',
    reason: data.reason || '',
    images: data.images || [],
    brochure: data.brochure || null
  });

  // Validate form and update parent
  useEffect(() => {
    const isValid = 
      formData.title.trim().length > 0 &&
      formData.title.length <= 120 &&
      formData.type.length > 0 &&
      formData.reason.trim().length > 0 &&
      formData.reason.length <= 500 &&
      formData.images.length <= 3;

    onValidationChange(isValid);

    if (isValid) {
      onChange({
        title: formData.title,
        type: formData.type as typeof NOVELTY_TYPES[number],
        reason: formData.reason,
        images: formData.images,
        brochure: formData.brochure
      });
    }
  }, [formData, onChange, onValidationChange]);

  const updateField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8">
      {/* Step header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Détails de votre nouveauté</h2>
        <p className="text-muted-foreground">
          Présentez votre nouveauté avec des informations détaillées
        </p>
      </div>

      <div className="space-y-6">
        {/* Title */}
        <div>
          <Label htmlFor="title">Titre de la nouveauté *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Nom de votre nouveauté"
            maxLength={120}
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              Un titre accrocheur et descriptif
            </p>
            <p className="text-xs text-muted-foreground">
              {formData.title.length}/120
            </p>
          </div>
        </div>

        {/* Type */}
        <div>
          <Label htmlFor="type">Type de nouveauté *</Label>
          <Select value={formData.type} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez le type" />
            </SelectTrigger>
            <SelectContent>
              {NOVELTY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {NOVELTY_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reason */}
        <div>
          <Label htmlFor="reason">Pourquoi c'est intéressant ? *</Label>
          <Textarea
            id="reason"
            value={formData.reason}
            onChange={(e) => updateField('reason', e.target.value)}
            placeholder="Expliquez en quoi votre nouveauté est remarquable et pourquoi elle intéressera les visiteurs..."
            rows={4}
            maxLength={500}
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              Mettez en avant les avantages, innovations ou bénéfices clés
            </p>
            <p className="text-xs text-muted-foreground">
              {formData.reason.length}/500
            </p>
          </div>
        </div>

        {/* Images */}
        <div>
          <Label>Images de la nouveauté</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Ajoutez jusqu'à 3 images pour présenter votre nouveauté
          </p>
          <ImagesUploader
            files={formData.images}
            onChange={(files) => updateField('images', files)}
            maxFiles={3}
          />
        </div>

        {/* Resource file */}
        <div>
          <ResourceUploader
            file={formData.brochure}
            onChange={(file) => updateField('brochure', file)}
            label="Dossier de présentation (optionnel)"
          />
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Récapitulatif</h4>
        <div className="text-sm space-y-1">
          <p><strong>Titre :</strong> {formData.title || 'À compléter'}</p>
          <p><strong>Type :</strong> {formData.type ? NOVELTY_TYPE_LABELS[formData.type as keyof typeof NOVELTY_TYPE_LABELS] : 'À sélectionner'}</p>
          <p><strong>Images :</strong> {formData.images.length}/3</p>
          <p><strong>Dossier PDF :</strong> {formData.brochure ? '✓ Ajouté' : 'Aucun'}</p>
        </div>
      </div>
    </div>
  );
}