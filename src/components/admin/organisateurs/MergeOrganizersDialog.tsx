import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitMerge, ArrowRight, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrgOption {
  organizer_id: string;
  organizer_name: string;
  primary_domain: string;
  nb_domaines: number;
  nb_salons_total: number;
}

interface DetailPreview {
  organizer_name?: string;
  primary_domain?: string;
  domains?: { domain: string }[];
  events?: { id: string; nom_event: string }[];
}

function useOrgDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin-organizer-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_get_organizer_detail', {
        p_organizer_id: id,
      });
      if (error) throw error;
      return data as DetailPreview;
    },
  });
}

const MergeOrganizersDialog = ({ onMerged }: { onMerged: () => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const { data: options } = useQuery({
    queryKey: ['admin-organizers-options'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_list_organizers', {
        p_search: null, p_only_blocked: false, p_limit: 500, p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as OrgOption[];
    },
  });

  const sourceDetail = useOrgDetail(sourceId);
  const targetDetail = useOrgDetail(targetId);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_merge_organizers', {
        p_target_id: targetId, p_source_id: sourceId,
      });
      if (error) throw error;
      return data as { ok: boolean; domains_moved?: number; reason?: string };
    },
    onSuccess: (res) => {
      if (!res?.ok) {
        const msg = res?.reason === 'email_already_sent'
          ? "Fusion impossible : un email a déjà été envoyé pour l'un des deux organisateurs."
          : res?.reason === 'same_organizer'
          ? 'Choisis deux organisateurs différents.'
          : "Fusion impossible.";
        toast({ title: 'Fusion refusée', description: msg, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Fusion effectuée',
        description: `${res.domains_moved ?? 0} domaine(s) transféré(s). L'organisateur source a été supprimé.`,
      });
      setSourceId(null);
      setTargetId(null);
      setOpen(false);
      onMerged();
    },
    onError: () => toast({ title: 'Erreur', description: 'La fusion a échoué.', variant: 'destructive' }),
  });

  const sameOrg = !!sourceId && sourceId === targetId;
  const canMerge = !!sourceId && !!targetId && !sameOrg && !mutation.isPending;

  const renderPreview = (d: DetailPreview | undefined, label: string) => {
    if (!d) return null;
    return (
      <div className="rounded-md border p-3 space-y-1 flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{d.organizer_name || d.primary_domain}</div>
        <div className="text-xs text-muted-foreground">
          {(d.domains?.length ?? 0)} domaine(s) · {(d.events?.length ?? 0)} salon(s)
        </div>
        {!!d.domains?.length && (
          <div className="flex flex-wrap gap-1 pt-1">
            {d.domains.slice(0, 4).map((x) => (
              <Badge key={x.domain} variant="outline" className="text-[10px]">{x.domain}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitMerge className="h-4 w-4" />
          Fusionner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fusionner deux organisateurs</DialogTitle>
          <DialogDescription>
            L'organisateur <strong>source</strong> disparaît, ses domaines et salons sont
            rattachés à la <strong>cible</strong>. Action irréversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Source (disparaît)</label>
              <Select value={sourceId ?? undefined} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {(options ?? []).map((o) => (
                    <SelectItem key={o.organizer_id} value={o.organizer_id}>
                      {o.organizer_name} ({o.nb_salons_total})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cible (absorbe)</label>
              <Select value={targetId ?? undefined} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {(options ?? []).map((o) => (
                    <SelectItem key={o.organizer_id} value={o.organizer_id}>
                      {o.organizer_name} ({o.nb_salons_total})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sameOrg && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Source et cible doivent être différents.
            </div>
          )}

          {(sourceId || targetId) && (
            <div className="flex items-stretch gap-3">
              {renderPreview(sourceDetail.data, 'Source')}
              <div className="flex items-center"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div>
              {renderPreview(targetDetail.data, 'Cible')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canMerge}>
            {mutation.isPending ? '...' : 'Fusionner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MergeOrganizersDialog;
