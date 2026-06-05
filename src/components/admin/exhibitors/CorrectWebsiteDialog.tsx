import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export type InvalidWebsiteRow = {
  public_identity_id: string;
  public_slug: string;
  display_name: string;
  source_type: string;
  website: string;
  exhibitor_id: string | null;
  legacy_exposant_id?: string | null;
  reason: string;
};

type DuplicateCompany = {
  source?: string;
  id?: string;
  name?: string;
  website?: string;
  slug?: string | null;
  admin_link?: string | null;
};

type PreviewResult = {
  input?: string;
  normalized_url?: string | null;
  normalized_domain?: string | null;
  valid_url?: boolean;
  duplicate_found?: boolean;
  duplicate_company?: DuplicateCompany | null;
  can_update?: boolean;
  warnings?: string[];
};

interface Props {
  row: InvalidWebsiteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CorrectWebsiteDialog: React.FC<Props> = ({ row, open, onOpenChange, onSuccess }) => {
  const [newWebsite, setNewWebsite] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset on open/row change
  useEffect(() => {
    if (open) {
      setNewWebsite('');
      setReason('');
      setPreview(null);
      setErrorMsg(null);
      setChecking(false);
      setSaving(false);
    }
  }, [open, row?.public_identity_id]);

  const runPreview = async (value: string) => {
    if (!row || !value.trim()) {
      setPreview(null);
      return;
    }
    setChecking(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('admin_preview_exhibitor_website_update', {
        p_public_identity_id: row.public_identity_id,
        p_new_website: value,
      });
      if (error) throw error;
      setPreview((data ?? null) as PreviewResult | null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur de vérification.');
      setPreview(null);
    } finally {
      setChecking(false);
    }
  };

  // Debounced live preview
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!newWebsite.trim()) {
      setPreview(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runPreview(newWebsite);
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newWebsite]);

  const dup = preview?.duplicate_company ?? null;
  const dupLink = dup?.slug ? `/exposants/${dup.slug}` : dup?.admin_link ?? null;
  const canSave = !!preview?.can_update && !saving && !checking;

  const handleSave = async () => {
    if (!row || !canSave) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('admin_update_exhibitor_website', {
        p_public_identity_id: row.public_identity_id,
        p_new_website: newWebsite,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      const res = data as { status?: string; message?: string } | null;
      if (res?.status === 'blocked_duplicate') {
        setErrorMsg(res.message ?? 'Domaine déjà utilisé par une autre entreprise.');
        // refresh preview to reflect duplicate state
        void runPreview(newWebsite);
        return;
      }
      toast.success('Website mis à jour', {
        description: 'Pensez à mettre à jour Airtable pour éviter une réimportation.',
      });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Corriger le website</DialogTitle>
          <DialogDescription>
            Mettez à jour le site internet de l'exposant. L'URL est normalisée et vérifiée
            contre les doublons avant l'enregistrement.
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-medium">{row.display_name}</div>
              <div className="text-muted-foreground break-all">
                Website actuel : <span className="font-mono">{row.website || '—'}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="text-[10px]">{row.reason}</Badge>
                <Badge variant="outline" className="text-[10px]">source: {row.source_type}</Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  id: {row.public_identity_id.slice(0, 8)}…
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-website">Nouveau site web</Label>
              <Input
                id="new-website"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
                placeholder="exemple.fr ou https://exemple.fr"
                autoComplete="off"
                maxLength={500}
              />
            </div>

            {/* Preview / validation status */}
            {checking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vérification…
              </div>
            )}

            {!checking && preview && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {preview.valid_url ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="text-muted-foreground">URL normalisée :</span>
                  <span className="font-mono break-all">
                    {preview.normalized_url ?? '— invalide —'}
                  </span>
                </div>

                {!preview.valid_url && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>URL invalide. Corrigez le format pour pouvoir enregistrer.</span>
                  </div>
                )}

                {preview.valid_url && preview.duplicate_found && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400 text-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div>
                        Ce site est déjà associé à{' '}
                        <span className="font-semibold">{dup?.name ?? 'une autre entreprise'}</span>.
                        Mise à jour bloquée pour éviter un doublon.
                      </div>
                      {dupLink && (
                        <a
                          href={dupLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Voir l'entreprise existante
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="correct-reason">Motif (optionnel)</Label>
              <Textarea
                id="correct-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. site officiel retrouvé manuellement"
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Pensez à corriger aussi la donnée dans Airtable pour éviter qu'elle soit
                réimportée.
              </span>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CorrectWebsiteDialog;