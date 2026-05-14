import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Loader2,
  Play,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Settings2,
  Info,
} from 'lucide-react';

type RematchResult = {
  success?: boolean;
  dryRun?: boolean;
  importsProcessed?: number;
  estimatedNewMatches?: number;
  estimatedFutureNewMatches?: number;
  estimatedNotifications?: number;
  newMatchesCreated?: number;
  futureNewMatches?: number;
  notificationsCreated?: number;
  notificationsUpdated?: number;
  skippedNotificationsPreferences?: number;
  missingNotificationsCreated?: number;
  missingNotificationsSkippedExisting?: number;
  missingNotificationsSkippedPreferences?: number;
  reconciliationCandidatesFound?: number;
  reconciliationGroupsFound?: number;
  errors?: Array<{ importId: string; userId: string; message: string }>;
  error?: string;
};

const RadarCrmRematchPanel: React.FC = () => {
  const [maxImports, setMaxImports] = useState<string>('50');
  const [userId, setUserId] = useState('');
  const [importId, setImportId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState<'dry' | 'real' | null>(null);
  const [result, setResult] = useState<RematchResult | null>(null);
  const [resultMode, setResultMode] = useState<'dry' | 'real' | null>(null);
  const [lastDryRun, setLastDryRun] = useState<RematchResult | null>(null);
  const [lastDryRunKey, setLastDryRunKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentParamsKey = useMemo(
    () => `${maxImports}|${userId.trim()}|${importId.trim()}`,
    [maxImports, userId, importId],
  );

  const realRunEnabled = lastDryRunKey !== null && lastDryRunKey === currentParamsKey;

  const invoke = async (dryRun: boolean) => {
    setLoading(dryRun ? 'dry' : 'real');
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        dryRun,
        maxImports: Number(maxImports) || 50,
      };
      if (userId.trim()) payload.userId = userId.trim();
      if (importId.trim()) payload.importId = importId.trim();

      const { data, error } = await supabase.functions.invoke('radar-crm-rematch-cron', {
        body: payload,
      });
      if (error) throw error;
      const res = data as RematchResult;
      setResult(res);
      setResultMode(dryRun ? 'dry' : 'real');
      if (res?.success) {
        toast.success(dryRun ? 'Dry-run terminé' : 'Re-matching terminé');
        if (dryRun) {
          setLastDryRun(res);
          setLastDryRunKey(currentParamsKey);
        }
      } else {
        toast.error('Échec du re-matching');
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(`Erreur: ${msg}`);
      setResult({ success: false, error: msg });
      setResultMode(dryRun ? 'dry' : 'real');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Re-matching continu Radar CRM</CardTitle>
          <p className="text-sm text-muted-foreground">
            Relance le matching sur les imports CRM existants pour détecter les nouvelles
            opportunités créées par les nouveaux exposants ou événements ajoutés à Lotexpo.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground flex gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              Utilisez ce panneau pour tester ou déclencher manuellement le re-matching.
              Le dry-run doit toujours être lancé avant le run réel.
            </p>
          </div>
          <div>
            <Label className="text-xs">maxImports</Label>
            <Select value={maxImports} onValueChange={setMaxImports}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced options */}
          <div className="rounded-md border bg-muted/20">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40 transition-colors rounded-md"
              aria-expanded={showAdvanced}
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Options avancées de test</p>
                  <p className="text-xs text-muted-foreground">
                    Utilisez ces champs uniquement pour tester le re-matching sur un
                    utilisateur ou un import précis.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary shrink-0">
                <span>
                  {showAdvanced ? 'Masquer les options avancées' : 'Afficher les options avancées'}
                </span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {showAdvanced && (
              <div className="p-4 border-t space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adv-user-id" className="text-sm">userId</Label>
                  <Input
                    id="adv-user-id"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="UUID de l'utilisateur à tester"
                    className="font-mono text-sm w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionnel — limite le re-matching à un utilisateur précis.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adv-import-id" className="text-sm">importId</Label>
                  <Input
                    id="adv-import-id"
                    value={importId}
                    onChange={(e) => setImportId(e.target.value)}
                    placeholder="UUID de l'import à tester"
                    className="font-mono text-sm w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionnel — limite le re-matching à un import précis.
                  </p>
                </div>

                <div className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p>
                    Pour tester un import spécifique, renseignez à la fois{' '}
                    <span className="font-mono">userId</span> et{' '}
                    <span className="font-mono">importId</span>, puis lancez d'abord
                    l'étape 1 « Prévisualiser sans écrire ».
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">Étape 1 — Prévisualisation</p>
                  <p className="text-xs text-muted-foreground">
                    Estime les nouveaux matches et notifications potentielles sans modifier la base.
                  </p>
                </div>
                <Button onClick={() => invoke(true)} disabled={loading !== null}>
                  {loading === 'dry' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}
                  1. Prévisualiser sans écrire
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">Étape 2 — Exécution réelle</p>
                  <p className="text-xs text-muted-foreground">
                    Crée réellement les nouveaux matches et les notifications internes Radar CRM.
                  </p>
                  {!realRunEnabled && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      Lancez d'abord l'étape 1 avec ces paramètres.
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                  disabled={loading !== null || !realRunEnabled}
                >
                  {loading === 'real' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  2. Lancer le re-matching réel
                </Button>
              </div>
            </div>
          </div>

          {/* Last dry-run summary */}
          {lastDryRun && (
            <div className="rounded-md border p-4 bg-muted/30 space-y-2">
              <p className="text-sm font-semibold">Dernière prévisualisation</p>
              {(lastDryRun.importsProcessed ?? 0) === 0 &&
              (lastDryRun.estimatedNewMatches ?? 0) === 0 &&
              (lastDryRun.estimatedFutureNewMatches ?? 0) === 0 &&
              (lastDryRun.estimatedNotifications ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune nouvelle opportunité détectée avec ces paramètres.
                </p>
              ) : (
                <ul className="text-sm space-y-1">
                  <li>• Imports analysés : <strong>{lastDryRun.importsProcessed ?? 0}</strong></li>
                  <li>• Nouveaux matches estimés : <strong>{lastDryRun.estimatedNewMatches ?? 0}</strong></li>
                  <li>• Nouvelles opportunités futures estimées : <strong>{lastDryRun.estimatedFutureNewMatches ?? 0}</strong></li>
                  <li>• Nouvelles notifications potentielles : <strong>{lastDryRun.estimatedNotifications ?? 0}</strong></li>
                </ul>
              )}
              <p className="text-xs text-muted-foreground pt-1 border-t mt-2">
                La prévisualisation estime les nouveaux matches. Le run réel vérifie aussi les
                notifications manquées sur des matches déjà existants.
              </p>
            </div>
          )}

          {/* Last call result (real run details / errors) */}
          {result && resultMode === 'real' && (
            <div className="rounded-md border p-4 bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={result.success ? 'secondary' : 'destructive'}>Run réel</Badge>
                {result.success ? (
                  <span className="text-sm text-muted-foreground">Terminé avec succès</span>
                ) : (
                  <span className="text-sm text-destructive">{result.error ?? 'Échec'}</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label="importsProcessed" value={result.importsProcessed} />
                <Stat label="newMatchesCreated" value={result.newMatchesCreated} />
                <Stat label="futureNewMatches" value={result.futureNewMatches} />
                <Stat label="notificationsCreated" value={result.notificationsCreated} />
                <Stat label="notificationsUpdated" value={result.notificationsUpdated} />
                <Stat
                  label="skippedNotificationsPreferences"
                  value={result.skippedNotificationsPreferences}
                />
                <Stat
                  label="Matches existants éligibles à réconciliation"
                  value={result.reconciliationCandidatesFound}
                />
                <Stat
                  label="Groupes de notifications à vérifier"
                  value={result.reconciliationGroupsFound}
                />
                <Stat
                  label="Notifications manquées réparées"
                  value={result.missingNotificationsCreated}
                />
                <Stat
                  label="Notifications déjà existantes"
                  value={result.missingNotificationsSkippedExisting}
                />
                <Stat
                  label="Notifications ignorées par préférences"
                  value={result.missingNotificationsSkippedPreferences}
                />
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-destructive mb-1">
                    Erreurs ({result.errors.length})
                  </p>
                  <pre className="text-xs bg-background p-2 rounded border max-h-48 overflow-auto">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le re-matching réel</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Cette action peut créer de nouveaux matches Radar CRM et des notifications
                  internes pour les utilisateurs concernés.
                </p>
                {lastDryRun && (
                  <div>
                    <p className="font-semibold text-foreground">Dernier dry-run :</p>
                    <ul className="mt-1 space-y-0.5">
                      <li>• {lastDryRun.estimatedNewMatches ?? 0} nouveaux matches estimés</li>
                      <li>• {lastDryRun.estimatedFutureNewMatches ?? 0} opportunités futures estimées</li>
                      <li>• {lastDryRun.estimatedNotifications ?? 0} notifications potentielles</li>
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                invoke(false);
              }}
            >
              Confirmer le re-matching réel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number | undefined }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold">{value ?? 0}</span>
  </div>
);

export default RadarCrmRematchPanel;
