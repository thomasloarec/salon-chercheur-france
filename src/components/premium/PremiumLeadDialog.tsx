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
import { Loader2, CheckCircle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PremiumLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  eventSlug?: string;
}

export function PremiumLeadDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventDate,
  eventSlug,
}: PremiumLeadDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('premium-lead-submit', {
        body: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          eventId: eventId || '',
          eventName: eventName || '',
          eventDate: eventDate || '',
          eventSlug: eventSlug || '',
        },
      });

      if (error) {
        console.error('Error submitting premium lead:', error);
        throw error;
      }

      console.log('Premium lead submitted:', data);

      setIsSuccess(true);
      toast({
        title: '✅ Demande envoyée !',
        description: 'Notre équipe vous recontactera sous 24h pour finaliser votre passage au Premium.',
      });

      setTimeout(() => {
        onOpenChange(false);
        setIsSuccess(false);
        setFormData({ firstName: '', lastName: '', email: '', phone: '', company: '' });
      }, 2000);

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'envoyer votre demande. Réessayez plus tard.',
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
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Demande envoyée !</h3>
            <p className="text-muted-foreground">
              Notre équipe vous recontactera sous 24h
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Passer au Premium
              </DialogTitle>
              <DialogDescription>
                Remplissez ce formulaire et notre équipe vous recontactera pour activer votre compte Premium.
                {eventName && (
                  <span className="block mt-2 text-primary font-medium">
                    Événement : {eventName}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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

              <div>
                <Label htmlFor="phone">
                  Téléphone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  placeholder="06 12 34 56 78"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <Label htmlFor="company">
                  Entreprise <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={handleChange('company')}
                  placeholder="Nom de votre entreprise"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  ✨ Avec le Premium :
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>✓ Jusqu'à 5 nouveautés par événement</li>
                  <li>✓ Leads illimités avec coordonnées complètes</li>
                  <li>✓ Export CSV pour votre CRM</li>
                  <li>✓ Statistiques en temps réel</li>
                </ul>
                <p className="text-sm font-bold text-primary mt-2">
                  99€ HT par nouveauté
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                En envoyant ce formulaire, vous acceptez d'être recontacté par notre équipe commerciale.
                Vos données sont traitées conformément au RGPD.
              </p>

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
                      <Zap className="h-4 w-4" />
                      Envoyer ma demande
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
