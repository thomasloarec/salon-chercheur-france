import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plug, FileSpreadsheet, Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RadarCsvUploader from '@/components/radar-crm/RadarCsvUploader';
import QualificationDialog from '@/components/directeur-commercial/QualificationDialog';
import { savePendingImport } from '@/lib/radarCrm/tracking';
import type { ParsedCrmFile } from '@/lib/radarCrm/parseFile';

export type CrmSource = 'hubspot' | 'csv' | 'salesforce' | 'pipedrive' | 'zoho' | 'autre';

const SOURCES: {
  value: CrmSource;
  label: string;
  status?: 'Disponible' | 'Bientôt';
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'hubspot', label: 'HubSpot', status: 'Disponible', icon: Plug },
  { value: 'csv', label: 'Fichier CSV / Excel', status: 'Disponible', icon: FileSpreadsheet },
  { value: 'salesforce', label: 'Salesforce', status: 'Bientôt', icon: Database },
  { value: 'pipedrive', label: 'Pipedrive', status: 'Bientôt', icon: Database },
  { value: 'zoho', label: 'Zoho', status: 'Bientôt', icon: Database },
  { value: 'autre', label: 'Autre CRM', icon: Database },
];

const CRM_LABEL: Record<string, string> = {
  salesforce: 'Salesforce',
  pipedrive: 'Pipedrive',
  zoho: 'Zoho',
  autre: 'Autre',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fourni par Radar CRM : reprend le flux d'import existant sur la page. */
  onCsvParsed?: (parsed: ParsedCrmFile) => void;
  /** Source à relancer automatiquement (retour d'authentification). */
  initialSource?: CrmSource | null;
  /** Chemin de retour après authentification. */
  redirectPath?: string;
}

const ConnectCrmDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onCsvParsed,
  initialSource = null,
  redirectPath = '/radar-crm',
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'csv'>('select');
  const [selectedCrm, setSelectedCrm] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [hubspotLoading, setHubspotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requireAuth = (source: CrmSource) => {
    const target = `${redirectPath}${redirectPath.includes('?') ? '&' : '?'}connect=${source}`;
    navigate(`/auth?redirect=${encodeURIComponent(target)}`);
  };

  const connectHubSpot = async () => {
    setHubspotLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('oauth-hubspot');
      if (fnError) throw fnError;
      if (data?.installUrl && typeof data.installUrl === 'string') {
        window.location.href = data.installUrl;
        return;
      }
      const stage = data?.stage || data?.code || 'unknown';
      const message = data?.message || data?.error || 'Réponse inattendue du serveur';
      setError(`Échec : ${stage} — ${message}`);
    } catch (err) {
      setError(`Échec : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setHubspotLoading(false);
    }
  };

  const handleSelect = (source: CrmSource) => {
    setError(null);
    if (source === 'hubspot') {
      if (!user) return requireAuth('hubspot');
      void connectHubSpot();
      return;
    }
    if (source === 'csv') {
      if (!user) return requireAuth('csv');
      setStep('csv');
      return;
    }
    setSelectedCrm(CRM_LABEL[source] ?? 'Autre');
    onOpenChange(false);
    setFormOpen(true);
  };

  // Reprise automatique après authentification.
  useEffect(() => {
    if (!open || !initialSource || !user) return;
    handleSelect(initialSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSource, user]);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setError(null);
    }
  }, [open]);

  const handleParsed = (parsed: ParsedCrmFile) => {
    onOpenChange(false);
    if (onCsvParsed) {
      onCsvParsed(parsed);
      return;
    }
    try {
      savePendingImport({
        fileName: parsed.fileName,
        mapping: {},
        rows: parsed.rows,
        sourceType: parsed.sourceType,
        sheetName: parsed.sheetName,
      });
    } catch {
      /* reprise best-effort */
    }
    navigate('/radar-crm');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="heading-display">
              {step === 'csv' ? 'Importez vos comptes' : 'Comment voulez-vous démarrer ?'}
            </DialogTitle>
            <DialogDescription>
              {step === 'csv'
                ? 'Deux colonnes suffisent : nom de l’entreprise et site web.'
                : 'Connectez votre CRM ou importez un fichier. Vos données restent privées.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'select' ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {SOURCES.map((s) => {
                  const Icon = s.icon;
                  const busy = s.value === 'hubspot' && hubspotLoading;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSelect(s.value)}
                      disabled={busy}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                          <Icon className="h-5 w-5 text-primary" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.label}
                        </span>
                        {s.status && (
                          <Badge
                            variant={s.status === 'Disponible' ? 'default' : 'secondary'}
                            className="mt-1"
                          >
                            {s.status}
                          </Badge>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {error && (
                <p className="text-sm text-destructive" aria-live="assertive">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <RadarCsvUploader onParsed={handleParsed} />
              <Button variant="ghost" onClick={() => setStep('select')} className="rounded-full">
                Retour
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QualificationDialog
        lastSearchedCompany={null}
        defaultCrm={selectedCrm ?? undefined}
        open={formOpen}
        onOpenChange={setFormOpen}
        hideTrigger
      />
    </>
  );
};

export default ConnectCrmDialog;