import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Radar, ShieldCheck, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import RadarCsvUploader from '@/components/radar-crm/RadarCsvUploader';
import RadarColumnMapper from '@/components/radar-crm/RadarColumnMapper';
import RadarPreviewTable from '@/components/radar-crm/RadarPreviewTable';
import { autoDetectMapping, RADAR_FIELD_REQUIRED, RadarField } from '@/lib/radarCrm/columnDetection';
import {
  trackRadarEvent, savePendingImport, loadPendingImport, clearPendingImport,
} from '@/lib/radarCrm/tracking';

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

const RadarCrmPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<RadarField, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void trackRadarEvent('radar_page_viewed');
  }, []);

  // If user just authenticated, restore pending CSV
  useEffect(() => {
    if (!user || parsed) return;
    const pending = loadPendingImport();
    if (pending) {
      const headers = Object.keys(pending.rows[0] ?? {});
      setParsed({ fileName: pending.fileName, headers, rows: pending.rows });
      setMapping(pending.mapping as Partial<Record<RadarField, string>>);
    }
  }, [user, parsed]);

  const onParsed = (p: ParsedFile) => {
    setParsed(p);
    setMapping(autoDetectMapping(p.headers));
  };

  const missingRequired = useMemo(
    () => (Object.keys(RADAR_FIELD_REQUIRED) as RadarField[])
      .filter((f) => RADAR_FIELD_REQUIRED[f] && !mapping[f]),
    [mapping],
  );

  const handleAuthGate = async (mode: 'login' | 'signup') => {
    if (!parsed) return;
    savePendingImport({
      fileName: parsed.fileName,
      mapping: mapping as Record<string, string>,
      rows: parsed.rows,
    });
    void trackRadarEvent(mode === 'login' ? 'login_started_from_radar' : 'signup_started_from_radar');
    void trackRadarEvent('auth_required_shown');
    navigate(`/auth?redirect=${encodeURIComponent('/radar-crm')}${mode === 'signup' ? '&mode=signup' : ''}`);
  };

  const handleSubmit = async () => {
    if (!parsed || !user) return;
    if (missingRequired.length > 0) {
      toast({ title: 'Mapping incomplet', description: 'Renseignez les colonnes requises.' });
      return;
    }
    setSubmitting(true);
    void trackRadarEvent('crm_import_started', { rows: parsed.rows.length });
    try {
      const { data, error } = await supabase.functions.invoke('crm-import', {
        body: {
          fileName: parsed.fileName,
          sourceType: 'csv',
          mapping,
          rows: parsed.rows,
        },
      });
      if (error) throw error;
      const result = data as { importId?: string; matchesCount?: number; matchedCompaniesCount?: number };
      void trackRadarEvent('crm_import_completed', {
        importId: result.importId,
        matches: result.matchesCount,
        matchedCompanies: result.matchedCompaniesCount,
      });
      clearPendingImport();
      toast({
        title: 'Analyse terminée',
        description: `${result.matchedCompaniesCount ?? 0} entreprise(s) détectée(s) sur des salons.`,
      });
      navigate(`/radar-crm/results?importId=${result.importId ?? ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      void trackRadarEvent('crm_import_failed', { error: msg });
      toast({ title: 'Échec de l\'import', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Radar CRM — détectez vos comptes sur les salons | Lotexpo</title>
        <meta
          name="description"
          content="Importez votre fichier CRM au format CSV. Lotexpo détecte automatiquement les salons où vos prospects, clients et concurrents exposent."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
          {/* Hero */}
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" /> Nouveau
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Découvrez à quels salons participent vos prospects, clients ou concurrents
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Importez votre fichier CRM au format CSV. Lotexpo détecte automatiquement les événements où vos comptes sont présents, afin de vous aider à préparer vos visites commerciales.
            </p>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
              <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Vos données restent privées</p>
                <p className="text-muted-foreground text-xs">Visibles uniquement par vous.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
              <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Matching basé sur le domaine</p>
                <p className="text-muted-foreground text-xs">Détection exacte par site web.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Analyse après connexion</p>
                <p className="text-muted-foreground text-xs">Aucune donnée envoyée avant.</p>
              </div>
            </div>
          </div>

          {/* Step 1 — Upload */}
          {!parsed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radar className="h-5 w-5" /> 1. Importez votre fichier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadarCsvUploader onParsed={onParsed} />
              </CardContent>
            </Card>
          )}

          {/* Step 2 — Mapping + preview + gate/submit */}
          {parsed && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fichier détecté</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Nom : </span>{parsed.fileName}</p>
                  <p><span className="text-muted-foreground">Lignes : </span>{parsed.rows.length.toLocaleString('fr-FR')}</p>
                  <p><span className="text-muted-foreground">Colonnes : </span>{parsed.headers.length}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => { setParsed(null); setMapping({}); }}
                  >
                    Changer de fichier
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. Confirmez le mapping des colonnes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadarColumnMapper
                    headers={parsed.headers}
                    mapping={mapping}
                    onChange={setMapping}
                  />
                  {missingRequired.length > 0 && (
                    <p className="text-sm text-destructive">
                      Colonnes requises manquantes : {missingRequired.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>3. Aperçu (5 premières lignes)</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadarPreviewTable headers={parsed.headers} rows={parsed.rows} />
                </CardContent>
              </Card>

              {!authLoading && !user && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" /> Votre analyse Radar CRM est prête
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Connectez-vous ou créez un compte pour voir les entreprises détectées sur les salons, les événements associés et les stands à visiter.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={() => handleAuthGate('signup')} className="flex-1">
                        Créer mon compte et voir mes résultats
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button onClick={() => handleAuthGate('login')} variant="outline" className="flex-1">
                        Se connecter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {user && (
                <Card>
                  <CardHeader>
                    <CardTitle>4. Lancez l'analyse</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Le matching MVP repose sur une correspondance exacte du domaine web. Certains groupes utilisant des sous-domaines pays peuvent ne pas être détectés.
                    </p>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || missingRequired.length > 0}
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      {submitting ? 'Analyse en cours…' : 'Lancer l\'analyse Radar CRM'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RadarCrmPage;
