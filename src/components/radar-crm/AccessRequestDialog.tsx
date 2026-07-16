import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';

type Step = 'intro' | 'form' | 'success';

interface ProfileRow {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  phone: string | null;
}

interface AccessRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

const AccessRequestDialog: React.FC<AccessRequestDialogProps> = ({ open, onOpenChange, source = 'locked_view' }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('intro');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = user?.email ?? '';

  // Reset to intro each time the dialog opens.
  useEffect(() => {
    if (open) {
      setStep('intro');
      setError(null);
    }
  }, [open]);

  // Pré-remplissage depuis le profil quand on entre dans le formulaire.
  useEffect(() => {
    if (step !== 'form' || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, company, job_title, phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const p = data as ProfileRow;
      setFirstName(p.first_name ?? '');
      setLastName(p.last_name ?? '');
      setCompany(p.company ?? '');
      setJobTitle(p.job_title ?? '');
      setPhone(p.phone ?? '');
    })();
    return () => { cancelled = true; };
  }, [step, user]);

  const canSubmit = useMemo(
    () =>
      firstName.trim() !== '' &&
      lastName.trim() !== '' &&
      company.trim() !== '' &&
      jobTitle.trim() !== '' &&
      phone.trim() !== '',
    [firstName, lastName, company, jobTitle, phone],
  );

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('submit_radar_access_request', {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_company: company.trim(),
        p_job_title: jobTitle.trim(),
        p_phone: phone.trim(),
      });
      if (rpcError) {
        if (rpcError.message?.includes('missing_required_fields')) {
          setError('Tous les champs sont requis.');
        } else {
          setError("Une erreur est survenue lors de l'envoi. Veuillez réessayer.");
        }
        return;
      }
      void trackRadarEvent('crm_access_requested', { source });
      // Le profil a été complété côté serveur par la RPC : on rafraîchit le cache.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-complete'] });
      setStep('success');
    } catch {
      setError("Une erreur est survenue lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle>Demander l'accès à Radar CRM</DialogTitle>
              <DialogDescription>
                Radar CRM identifie les entreprises de votre CRM qui exposent sur les salons à venir, avec leur stand
                et un accès direct à leur fiche — pour préparer vos visites et vos rendez-vous.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-foreground/70">
              Écrivez-nous pour activer votre accès. Nous revenons vers vous rapidement.
            </p>
            <DialogFooter>
              <Button onClick={() => setStep('form')} className="w-full sm:w-auto">
                <Mail className="h-4 w-4 mr-2" /> Nous contacter
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Demander l'accès à Radar CRM</DialogTitle>
              <DialogDescription>
                Vérifiez vos informations. Nous revenons vers vous rapidement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ar-first">Prénom</Label>
                  <Input id="ar-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ar-last">Nom</Label>
                  <Input id="ar-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ar-email">Email</Label>
                <Input id="ar-email" value={email} readOnly disabled className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ar-company">Entreprise</Label>
                <Input id="ar-company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ar-job">Rôle / fonction</Label>
                <Input id="ar-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ar-phone">Téléphone</Label>
                <Input id="ar-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {error && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('intro')} disabled={submitting}>
                Retour
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Envoyer la demande
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-foreground" /> Demande envoyée
              </DialogTitle>
              <DialogDescription>
                Nous revenons vers vous rapidement.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccessRequestDialog;