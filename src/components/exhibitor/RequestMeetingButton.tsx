import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RequestMeetingButtonProps {
  exhibitorRef: string;
  eventId: string;
  exhibitorName: string;
  variant?: 'default' | 'compact';
}

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  company: '',
  role: '',
  phone: '',
  notes: '',
};

export function RequestMeetingButton({
  exhibitorRef,
  eventId,
  exhibitorName,
  variant = 'default',
}: RequestMeetingButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY);

  const setField = (field: keyof typeof EMPTY) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('leads-create', {
        body: {
          lead_type: 'meeting_request',
          exhibitor_ref: exhibitorRef,
          event_id: eventId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          company: formData.company || undefined,
          role: formData.role || undefined,
          phone: formData.phone || undefined,
          notes: formData.notes || undefined,
        },
      });

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        let body: any = null;
        try {
          body = await (error as any)?.context?.json?.();
        } catch {
          /* ignore */
        }
        if (status === 403 || body?.error === 'not_eligible') {
          toast({
            title: 'Rendez-vous indisponible',
            description: "Cet exposant n'est plus disponible pour un rendez-vous.",
          });
          setOpen(false);
          return;
        }
        throw error;
      }

      if (data?.duplicate) {
        toast({
          title: 'Demande déjà envoyée',
          description: 'Vous avez déjà demandé un rendez-vous avec cet exposant pour ce salon.',
        });
        setOpen(false);
        setFormData(EMPTY);
        return;
      }

      toast({
        title: 'Demande envoyée',
        description: `${exhibitorName} recevra votre demande de rendez-vous et vous recontactera.`,
      });
      setOpen(false);
      setFormData(EMPTY);
    } catch (err: any) {
      console.error('Error creating meeting request:', err);
      toast({
        title: 'Erreur',
        description: "Impossible d'envoyer votre demande. Réessayez dans un instant.",
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompact = variant === 'compact';

  return (
    <>
      <Button
        type="button"
        size={isCompact ? 'sm' : 'default'}
        variant={isCompact ? 'outline' : 'default'}
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <CalendarPlus className="h-4 w-4" />
        Obtenir un rendez-vous
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isSubmitting) return;
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              Demander un rendez-vous avec {exhibitorName}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rdv_first_name">Prénom *</Label>
                <Input
                  id="rdv_first_name"
                  value={formData.first_name}
                  onChange={setField('first_name')}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="rdv_last_name">Nom *</Label>
                <Input
                  id="rdv_last_name"
                  value={formData.last_name}
                  onChange={setField('last_name')}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="rdv_email">Email *</Label>
              <Input
                id="rdv_email"
                type="email"
                value={formData.email}
                onChange={setField('email')}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="rdv_company">Société</Label>
              <Input
                id="rdv_company"
                value={formData.company}
                onChange={setField('company')}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rdv_role">Fonction</Label>
                <Input
                  id="rdv_role"
                  value={formData.role}
                  onChange={setField('role')}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="rdv_phone">Téléphone</Label>
                <Input
                  id="rdv_phone"
                  type="tel"
                  value={formData.phone}
                  onChange={setField('phone')}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="rdv_notes">Message (optionnel)</Label>
              <Textarea
                id="rdv_notes"
                value={formData.notes}
                onChange={setField('notes')}
                placeholder="Précisez vos besoins ou questions..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  'Envoyer la demande'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RequestMeetingButton;
