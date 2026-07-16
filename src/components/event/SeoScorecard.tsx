import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Users, Upload, PencilLine, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEventScorecard } from '@/hooks/useEventScorecard';

interface SeoScorecardProps {
  eventId: string;
  onSwitchToEdit?: () => void;
}

export const SeoScorecard: React.FC<SeoScorecardProps> = ({ eventId, onSwitchToEdit }) => {
  const { data, isLoading, error } = useEventScorecard(eventId);
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [localConfirmed, setLocalConfirmed] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: imports = [],
    refetch: refetchImports,
  } = useQuery({
    queryKey: ['organizer-exhibitor-imports', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizer_exhibitor_imports')
        .select('id, original_name, created_at, file_path')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleDownloadImport = async (file_path: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('organizer-exhibitor-import', {
        body: { action: 'signed_url', file_path },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error('URL indisponible');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.message || 'Téléchargement impossible');
    }
  };

  const downloadTemplate = () => {
    const header = 'Nom Exposant,Stand Exposant,Website Exposant,Description Exposant\n';
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-exposants.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const readAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        resolve(res.includes(',') ? res.split(',').pop() || '' : res);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await readAsBase64(file);
      const { data, error } = await supabase.functions.invoke('organizer-exhibitor-import', {
        body: {
          action: 'upload',
          event_id: eventId,
          file_base64: b64,
          file_name: file.name,
          content_type: file.type || 'application/octet-stream',
        },
      });
      if (error || !(data as any)?.success) throw error || new Error('Upload échoué');
      toast.success("Votre liste a bien été transmise. Notre équipe l'intègre sous quelques jours.");
      await refetchImports();
    } catch (err: any) {
      toast.error(err?.message || 'Upload impossible');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Impossible de charger la scorecard pour le moment.
      </p>
    );
  }

  const anyData = data as any;
  if (anyData?.error === 'not_authorized') {
    return (
      <p className="text-sm text-muted-foreground">
        Vous n'avez pas accès à la scorecard de ce salon.
      </p>
    );
  }

  const { completude, visibilite_30j, genere_le } = anyData;
  const pct = Math.max(0, Math.min(100, Number(completude?.pct_enrichies ?? 0)));
  const listeConfirmee = localConfirmed ?? Boolean(completude?.liste_confirmee);

  const handleToggleConfirm = async (checked: boolean) => {
    setConfirming(true);
    setLocalConfirmed(checked);
    try {
      const { error } = await supabase.rpc('set_exhibitors_complete' as any, {
        p_event_id: eventId,
        p_confirmed: checked,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['event-scorecard', eventId] });
      toast.success(checked ? 'Liste confirmée complète.' : 'Confirmation retirée.');
    } catch (e: any) {
      setLocalConfirmed(!checked);
      toast.error(e?.message || 'Impossible de mettre à jour.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Complétude */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">État de votre salon</h3>
          <Badge variant="secondary">{pct}%</Badge>
        </div>
        <Progress value={pct} />
        <div className="grid grid-cols-2 gap-3">
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Exposants référencés"
            value={completude?.exposants_references ?? 0}
          />
          <Metric
            icon={<Sparkles className="h-4 w-4" />}
            label="Exposants avec fiche détaillée"
            value={completude?.fiches_enrichies ?? 0}
            hint={`${pct}%`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {pct}% de vos exposants ont une fiche détaillée.
        </p>

        <div className="rounded-md border p-3 space-y-2">
          {listeConfirmee ? (
            <div className="flex items-center gap-2 text-sm text-info">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Liste confirmée complète</span>
              <button
                type="button"
                className="ml-auto text-xs text-muted-foreground underline"
                onClick={() => handleToggleConfirm(false)}
                disabled={confirming}
              >
                annuler
              </button>
            </div>
          ) : (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={listeConfirmee}
                onCheckedChange={(v) => handleToggleConfirm(Boolean(v))}
                disabled={confirming}
                className="mt-0.5"
              />
              <span>Je confirme que la liste de mes exposants est complète.</span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Si des exposants manquent, vous pourrez bientôt importer votre liste complète.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1.5" />
              )}
              Importer votre liste exposants
            </Button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs text-primary underline inline-flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Télécharger le modèle
            </button>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Format attendu : un fichier Excel (.xlsx) avec les 4 colonnes suivantes, dans cet ordre.
              <span className="block mt-0.5">
                Colonnes obligatoires : <span className="font-medium text-foreground/80">Nom Exposant</span> et{' '}
                <span className="font-medium text-foreground/80">Site Internet Exposant</span>.
              </span>
            </p>
            <div className="overflow-x-auto rounded-md border bg-background">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground">
                    <th className="w-8 border-r border-b px-2 py-1 text-center font-medium"></th>
                    <th className="border-r border-b px-2 py-1 text-center font-medium">A</th>
                    <th className="border-r border-b px-2 py-1 text-center font-medium">B</th>
                    <th className="border-r border-b px-2 py-1 text-center font-medium">C</th>
                    <th className="border-b px-2 py-1 text-center font-medium">D</th>
                  </tr>
                  <tr className="bg-muted/30 text-foreground">
                    <th className="w-8 border-r border-b px-2 py-1 text-center font-medium text-muted-foreground">1</th>
                    <th className="border-r border-b px-2 py-1 text-left font-semibold">
                      Nom Exposant <span className="text-destructive">*</span>
                    </th>
                    <th className="border-r border-b px-2 py-1 text-left font-semibold">Stand Exposant</th>
                    <th className="border-r border-b px-2 py-1 text-left font-semibold">
                      Site Internet Exposant <span className="text-destructive">*</span>
                    </th>
                    <th className="border-b px-2 py-1 text-left font-semibold">Description Exposant</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border-r border-b px-2 py-1 text-center text-muted-foreground bg-muted/30 font-medium">2</td>
                    <td className="border-r border-b px-2 py-1">Acme Textile</td>
                    <td className="border-r border-b px-2 py-1">A12</td>
                    <td className="border-r border-b px-2 py-1">https://acme-textile.com</td>
                    <td className="border-b px-2 py-1">Fabricant de tissus techniques</td>
                  </tr>
                  <tr>
                    <td className="border-r px-2 py-1 text-center text-muted-foreground bg-muted/30 font-medium">3</td>
                    <td className="border-r px-2 py-1">Studio Mode SA</td>
                    <td className="border-r px-2 py-1">B07</td>
                    <td className="border-r px-2 py-1">https://studiomode.fr</td>
                    <td className="px-2 py-1">Prêt-à-porter féminin</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <span className="text-destructive">*</span> champs obligatoires. Le stand et la description sont facultatifs.
            </p>
          </div>
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs font-medium text-foreground/80">Listes transmises</p>
            {imports.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune liste transmise pour l'instant.</p>
            ) : (
              <ul className="space-y-1">
                {imports.map((imp: any) => (
                  <li key={imp.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      <span className="text-muted-foreground">
                        {new Date(imp.created_at).toLocaleDateString('fr-FR')} ·{' '}
                      </span>
                      <span className="text-foreground">{imp.original_name}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleDownloadImport(imp.file_path)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Télécharger
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </Card>

      {/* Visibilité IA */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Visibilité dans l'IA (30 jours)</h3>
        {!visibilite_30j?.available || visibilite_30j?.below_threshold ? (
          <div className="rounded-md bg-muted px-3 py-2 space-y-1">
            <p className="text-sm text-foreground/80">
              Des informations sur votre visibilité dans les recherches IA apparaîtront prochainement ici.
            </p>
            <p className="text-xs text-muted-foreground">
              Plus vos exposants sont actifs sur Lotexpo, plus votre salon apparaît dans les recherches.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-foreground/80">
              <span className="font-semibold text-foreground">
                {visibilite_30j.requetes_secteur}
              </span>{' '}
              recherches touchaient vos secteurs sur 30 jours ; votre salon est apparu dans{' '}
              <span className="font-semibold text-foreground">
                {visibilite_30j.apparitions}
              </span>{' '}
              réponses.
            </p>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                Taux de capture : {visibilite_30j.taux_capture_pct}%
              </Badge>
              {typeof visibilite_30j.requetes_sans_reponse === 'number' && (
                <span className="text-xs text-muted-foreground">
                  {visibilite_30j.requetes_sans_reponse} recherches sans réponse
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {genere_le && (
        <p className="text-[11px] text-muted-foreground">
          Données à J-1 · généré le {new Date(genere_le).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}> = ({ icon, label, value, hint }) => (
  <div className="rounded-md border p-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className="text-lg font-semibold">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  </div>
);

export default SeoScorecard;