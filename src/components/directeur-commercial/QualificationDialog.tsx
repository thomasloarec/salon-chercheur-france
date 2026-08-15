import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const FIELDS: { key: string; label: string; options: string[] }[] = [
  { key: 'crm', label: 'CRM utilisé', options: ['HubSpot', 'Salesforce', 'Pipedrive', 'Zoho', 'Autre', 'Aucun'] },
  { key: 'team_size', label: 'Nombre de commerciaux', options: ['1 à 3', '4 à 10', '11 à 30', 'Plus de 30'] },
  { key: 'client_type', label: 'Type de clientèle', options: ['Mono-produit', 'Gamme variée'] },
  { key: 'product_type', label: "Ce que vend l'équipe", options: ['Produits', 'Services', 'Les deux'] },
  { key: 'salons_per_year', label: 'Salons ciblés par an', options: ['1 à 4', '5 à 10', 'Plus de 10'] },
];

interface Props {
  lastSearchedCompany: string | null;
  defaultCrm?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
}

const QualificationDialog = ({
  lastSearchedCompany,
  defaultCrm,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open && defaultCrm) {
      setValues((prev) => ({ ...prev, crm: defaultCrm }));
    }
  }, [open, defaultCrm]);

  const submit = async () => {
    setSending(true);
    const { error } = await supabase.rpc('submit_radar_lead', {
      p_crm: values.crm || undefined,
      p_team_size: values.team_size || undefined,
      p_client_type: values.client_type || undefined,
      p_product_type: values.product_type || undefined,
      p_salons_per_year: values.salons_per_year || undefined,
      p_contact_name: name.trim() || undefined,
      p_contact_email: email.trim() || undefined,
      p_message: message.trim() || undefined,
      p_searched_query: lastSearchedCompany || undefined,
    });
    setSending(false);
    if (error) {
      toast({
        title: "Envoi impossible",
        description: "Réessayez dans un instant.",
        variant: 'destructive',
      });
      return;
    }
    setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="lg" className="rounded-full px-7">
            Équiper mon équipe
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {done ? (
          <div className="py-8 text-center">
            <p className="heading-display text-xl">Merci, on revient vers vous.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="heading-display">Comment travaillez-vous ?</DialogTitle>
              <DialogDescription>
                Tous les champs sont optionnels. Deux minutes suffisent.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Select
                    value={values[f.key] ?? ''}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="lm-name">Nom</Label>
                <Input id="lm-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lm-email">Email</Label>
                <Input
                  id="lm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lm-msg">Message</Label>
                <Textarea
                  id="lm-msg"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <Button onClick={submit} disabled={sending} className="w-full rounded-full">
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QualificationDialog;