import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getEnv } from '@/lib/env';

interface NoveltyNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventSlug: string;
}

export function NoveltyNotificationDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventDate,
  eventSlug,
}: NoveltyNotificationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
  });

  // Calculer la date d'ouverture des nouveautés (J-60)
  const noveltiesOpenDate = new Date(eventDate);
  noveltiesOpenDate.setDate(noveltiesOpenDate.getDate() - 60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Récupérer les variables d'environnement
      const airtableToken = getEnv('VITE_AIRTABLE_TOKEN');
      const airtableBaseId = getEnv('VITE_AIRTABLE_BASE_ID');
      const airtableTableName = 'Leads Nouveautés'; // Nom exact de la table

      if (!airtableToken || !airtableBaseId) {
        throw new Error('Configuration Airtable manquante');
      }

      // Préparer les données pour Airtable
      const airtableData = {
        fields: {
          'Prénom': formData.firstName,
          'Nom': formData.lastName,
          'Email': formData.email,
          'Entreprise': formData.company || '',
          'Nom Événement': eventName,
          'Date Événement': eventDate,
          'Slug Événement': eventSlug,
          'ID Événement': eventId,
          'Date Ouverture Nouveautés': noveltiesOpenDate.toISOString().split('T')[0],
          'Statut Notification': 'En attente',
          'Date Inscription': new Date().toISOString(),
          'Source': 'LotExpo - Page Événement',
        },
      };

      // Envoyer vers Airtable
      const response = await fetch(
        `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${airtableToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(airtableData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Airtable error:', errorData);
        throw new Error('Erreur lors de l\'envoi vers Airtable');
      }

      // Succès
      setIsSuccess(true);
      toast({
        title: '✅ Inscription confirmée !',
        description: `Vous serez notifié(e) le ${format(noveltiesOpenDate, 'dd MMMM yyyy', { locale: fr })}`,
      });

      // Fermer après 2 secondes
      setTimeout(() => {
        onOpenChange(false);
        setIsSuccess(false);
        setFormData({ firstName: '', lastName: '', email: '', company: '' });
      }, 2000);

    } catch (error) {
      console.error('Error submitting notification:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer votre demande. Réessayez plus tard.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isSuccess ? (
          // État de succès
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">C'est noté !</h3>
            <p className="text-muted-foreground">
              Nous vous préviendrons dès l'ouverture des nouveautés
            </p>
          </div>
        ) : (
          // Formulaire
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Recevoir une notification
              </DialogTitle>
              <DialogDescription>
                Soyez alerté(e) dès l'ouverture des nouveautés pour <strong>{eventName}</strong>
                <br />
                <span className="text-primary font-medium">
                  Ouverture prévue : {format(noveltiesOpenDate, 'dd MMMM yyyy', { locale: fr })}
                </span>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Prénom */}
              <div>
                <Label htmlFor="firstName">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={handleChange('firstName')}
                  placeholder="Jean"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Nom */}
              <div>
                <Label htmlFor="lastName">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={handleChange('lastName')}
                  placeholder="Dupont"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">
                  Email professionnel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  placeholder="jean.dupont@entreprise.com"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Entreprise */}
              <div>
                <Label htmlFor="company">Entreprise (optionnel)</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={handleChange('company')}
                  placeholder="Nom de votre entreprise"
                  disabled={isSubmitting}
                />
              </div>

              {/* Note RGPD */}
              <p className="text-xs text-muted-foreground">
                En vous inscrivant, vous acceptez de recevoir un email de notification.
                Vos données sont stockées de manière sécurisée et ne seront pas partagées.
              </p>

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      M'alerter
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
