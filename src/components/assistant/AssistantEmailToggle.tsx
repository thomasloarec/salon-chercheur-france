import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

interface Props {
  value: boolean;
}

export default function AssistantEmailToggle({ value }: Props) {
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => setOn(value), [value]);

  const change = async (next: boolean) => {
    const prev = on;
    setOn(next);
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('assistant_set_email_alerts', { p_opt_in: next });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['assistant-feed'] });
      toast({ title: next ? 'Emails activés' : 'Emails coupés' });
    } catch {
      setOn(prev);
      toast({ title: 'Action impossible pour le moment. Réessayez.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card px-5 py-4">
      <Switch id="assistant-email-alerts" checked={on} onCheckedChange={change} disabled={busy} className="mt-0.5" />
      <label htmlFor="assistant-email-alerts" className="cursor-pointer">
        <span className="block text-base font-medium text-foreground">M'écrire quand il y a du nouveau</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          Un récapitulatif le mardi, et un message si une conférence ou un stand à ne pas manquer apparaît sur un salon proche. Jamais d'email vide.
        </span>
      </label>
    </div>
  );
}
