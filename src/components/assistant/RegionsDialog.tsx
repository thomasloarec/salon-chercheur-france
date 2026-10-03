import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RegionPicker from './RegionPicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: string[];
}

export default function RegionsDialog({ open, onOpenChange, initial }: Props) {
  const [codes, setCodes] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setCodes(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc('assistant_set_my_regions', { p_region_codes: codes });
      if (error) throw error;
      const res = (typeof data === 'string' ? JSON.parse(data) : data) ?? {};
      toast({ title: res.refresh ? 'Régions enregistrées. Je relance la recherche.' : 'Régions enregistrées.' });
      qc.invalidateQueries({ queryKey: ['assistant-feed'] });
      onOpenChange(false);
    } catch {
      toast({ title: 'Action impossible pour le moment. Réessayez.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-w-full flex-col overflow-y-auto rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="heading-display text-[26px]">Où êtes-vous prêt à aller ?</DialogTitle>
          <DialogDescription className="text-base">Je ne vous proposerai que les salons de ces régions.</DialogDescription>
        </DialogHeader>
        <div className="flex-1">
          <RegionPicker value={codes} onChange={setCodes} />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" className="min-h-12 w-full sm:w-auto" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
