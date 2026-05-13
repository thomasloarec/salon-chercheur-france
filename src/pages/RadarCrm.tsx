import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Radar, ShieldCheck, Sparkles, Zap, ArrowRight, Target, Map, Rocket,
  Upload, FileCheck2, Search, Lock, CheckCircle2, Eye, Globe, EyeOff,
  Building2, CalendarClock, MapPin,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import RadarCsvUploader from '@/components/radar-crm/RadarCsvUploader';
import RadarPreviewTable from '@/components/radar-crm/RadarPreviewTable';
import {
  autoDetectMapping, RADAR_FIELD_LABELS, RADAR_FIELD_REQUIRED, RadarField,
} from '@/lib/radarCrm/columnDetection';
import {
  trackRadarEvent, savePendingImport, loadPendingImport, clearPendingImport,
} from '@/lib/radarCrm/tracking';

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

const NONE = '__none__';
const PRIMARY_FIELDS: RadarField[] = ['company_name', 'website_raw'];
const ADVANCED_FIELDS: RadarField[] = ['crm_status', 'owner_name', 'owner_email', 'notes'];

const RadarCrmPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<RadarField, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void trackRadarEvent('radar_page_viewed');
    void trackRadarEvent('radar_landing_viewed');
  }, []);

  const scrollToUpload = (source: string) => {
    void trackRadarEvent('radar_landing_cta_clicked', { source });
    document.getElementById('radar-upload')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHowItWorks = () => {
    void trackRadarEvent('radar_landing_cta_clicked', { source: 'hero_secondary' });
    document.getElementById('radar-how').scrollIntoView({ behavior: 'smooth' });
  };

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
    setTimeout(() => {
      document.getElementById('radar-mapping')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const missingRequired = useMemo(
    () => (Object.keys(RADAR_FIELD_REQUIRED) as RadarField[])
      .filter((f) => RADAR_FIELD_REQUIRED[f] && !mapping[f]),
    [mapping],
  );

  const handleAuthGate = (mode: 'login' | 'signup') => {
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
      toast({ title: 'Mapping incomplet', description: 'Sélectionnez le nom et le site web.' });
      return;
    }
    setSubmitting(true);
    void trackRadarEvent('crm_import_started', { rows: parsed.rows.length });
    try {
      const { data, error } = await supabase.functions.invoke('crm-import', {
        body: { fileName: parsed.fileName, sourceType: 'csv', mapping, rows: parsed.rows },
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
      toast({ title: "Échec de l'import", description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (f: RadarField, v: string) => {
    const next = { ...mapping };
    if (v === NONE) delete next[f]; else next[f] = v;
    setMapping(next);
  };

  return (
    <MainLayout
      title="Radar CRM | Détectez vos prospects sur les salons"
      description="Importez votre CRM. Lotexpo détecte automatiquement les salons où vos prospects, clients et concurrents exposent."
    >
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))' }}
        />
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge className="mb-5 inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
              <Sparkles className="h-3.5 w-3.5" /> Beta
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              Transformez votre fichier CRM en{' '}
              <span className="text-primary">plan d'action salon</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8">
              Importez votre fichier CSV et découvrez les salons où vos prospects, clients,
              partenaires ou concurrents exposent.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <Button size="lg" onClick={() => scrollToUpload('hero_primary')}>
                <Upload className="h-4 w-4 mr-2" /> Importer mon fichier CSV
              </Button>
              <Button size="lg" variant="outline" onClick={scrollToHowItWorks}>
                Voir comment ça marche
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Analyse sécurisée. Vos données restent privées. Matching basé sur les sites web.
            </p>
          </div>

          {/* Hero preview card */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-accent/10 to-transparent rounded-3xl blur-2xl -z-10" />
            <Card className="shadow-xl border-primary/10">
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <Radar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">Votre Radar CRM</p>
                      <p className="text-xs text-muted-foreground">Aperçu d'un résultat</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Démo</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Entreprises analysées" value="310" />
                  <StatTile label="Détectées sur salons" value="60" accent />
                  <StatTile label="Participations futures" value="12" />
                  <StatTile label="Prochain salon" value="Dans 9 j" />
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">SEPEM Brest</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Brest · Dans 9 jours</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px]">3 comptes</Badge>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <CompanyRow name="OSE" stand="A56" />
                    <CompanyRow name="MAX EUROPE" stand="E35" />
                    <CompanyRow name="LES MECAMIENS" stand="A39" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BenefitCard
            icon={<Target className="h-5 w-5" />}
            title="Détectez vos comptes"
            text="Repérez automatiquement les entreprises de votre réseau présentes sur les salons Lotexpo."
          />
          <BenefitCard
            icon={<Map className="h-5 w-5" />}
            title="Priorisez vos déplacements"
            text="Identifiez les événements où plusieurs prospects ou clients seront présents."
          />
          <BenefitCard
            icon={<Rocket className="h-5 w-5" />}
            title="Passez à l'action"
            text="Ajoutez les salons à vos favoris, préparez vos visites et contactez les bons comptes au bon moment."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="radar-how" className="max-w-5xl mx-auto px-4 py-8 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold text-center mb-6">Comment fonctionne Radar CRM ?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Step n={1} icon={<Upload className="h-5 w-5" />} title="Importez un CSV" text="Avec vos entreprises (nom + site web)." />
          <Step n={2} icon={<Search className="h-5 w-5" />} title="Matching automatique" text="Lotexpo détecte les correspondances par domaine." />
          <Step n={3} icon={<Radar className="h-5 w-5" />} title="Plan d'action" text="Consultez les salons à venir et les comptes à rencontrer." />
        </div>
      </section>

      {/* Trust strip */}
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TrustItem icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Données privées" sub="Visibles uniquement par vous." />
          <TrustItem icon={<Zap className="h-4 w-4 text-primary" />} label="Matching exact" sub="Basé sur le domaine web." />
          <TrustItem icon={<FileCheck2 className="h-4 w-4 text-primary" />} label="2 colonnes suffisent" sub="Nom + site web." />
        </div>
      </section>

      {/* Upload zone */}
      <section id="radar-upload" className="max-w-4xl mx-auto px-4 py-10 scroll-mt-24">
        {!parsed && (
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="text-center mb-5">
                <h3 className="text-xl font-semibold mb-1">Importez votre fichier CSV</h3>
                <p className="text-sm text-muted-foreground">
                  Colonnes nécessaires : <strong>entreprise</strong> + <strong>site web</strong>.
                </p>
              </div>
              <RadarCsvUploader onParsed={onParsed} />
            </CardContent>
          </Card>
        )}

        {parsed && (
          <div className="space-y-6" id="radar-mapping">
            {/* File summary */}
            <Card className="bg-card">
              <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{parsed.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsed.rows.length.toLocaleString('fr-FR')} lignes · {parsed.headers.length} colonnes
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setParsed(null); setMapping({}); }}
                >
                  Changer de fichier
                </Button>
              </CardContent>
            </Card>

            {/* Simplified mapping */}
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Vérifiez les colonnes essentielles</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous avons détecté automatiquement les colonnes principales. Vérifiez simplement
                    que le nom d'entreprise et le site web sont corrects.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PRIMARY_FIELDS.map((f) => (
                    <FieldSelect
                      key={f}
                      label={RADAR_FIELD_LABELS[f]}
                      required
                      headers={parsed.headers}
                      value={mapping[f] ?? NONE}
                      onChange={(v) => setField(f, v)}
                    />
                  ))}
                </div>
                {missingRequired.length > 0 && (
                  <p className="text-sm text-destructive">
                    Sélectionnez la colonne pour : {missingRequired.map((f) => RADAR_FIELD_LABELS[f]).join(', ')}
                  </p>
                )}

                <Accordion type="single" collapsible>
                  <AccordionItem value="advanced" className="border-none">
                    <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                      Options avancées (statut CRM, commercial, notes)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {ADVANCED_FIELDS.map((f) => (
                          <FieldSelect
                            key={f}
                            label={RADAR_FIELD_LABELS[f]}
                            headers={parsed.headers}
                            value={mapping[f] ?? NONE}
                            onChange={(v) => setField(f, v)}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium mb-3">Aperçu — 5 premières lignes</p>
                <RadarPreviewTable headers={parsed.headers} rows={parsed.rows} />
              </CardContent>
            </Card>

            {/* Auth gate / submit */}
            {!authLoading && !user && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 mt-0.5 text-primary" />
                    <div>
                      <h3 className="font-semibold">Votre analyse est prête</h3>
                      <p className="text-sm text-muted-foreground">
                        Connectez-vous pour voir les entreprises détectées, les salons et les stands.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => handleAuthGate('signup')} className="flex-1">
                      Créer mon compte et voir mes résultats <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button onClick={() => handleAuthGate('login')} variant="outline" className="flex-1">
                      Se connecter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {user && (
              <div className="flex justify-center">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || missingRequired.length > 0}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Radar className="mr-2 h-4 w-4" />
                  {submitting ? 'Analyse en cours…' : "Lancer l'analyse Radar CRM"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Beta connections strip */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-accent/5 p-8">
          <div className="text-center mb-6">
            <Badge className="mb-3 bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Beta</Badge>
            <h2 className="text-2xl font-bold mb-2">Une Beta déjà utile, bientôt connectée à votre CRM</h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Radar CRM est actuellement disponible en Beta avec un import CSV. Les connexions directes à vos outils CRM sont en cours de préparation.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ConnectorBadge name="CSV" status="Disponible en Beta" available />
            <ConnectorBadge name="HubSpot" status="Bientôt" />
            <ConnectorBadge name="Salesforce" status="Bientôt" />
            <ConnectorBadge name="Pipedrive" status="Bientôt" />
            <ConnectorBadge name="Zoho CRM" status="Bientôt" />
          </div>
          <div className="text-center mt-6">
            <Button onClick={() => scrollToUpload('beta_section')}>
              <Upload className="h-4 w-4 mr-2" /> Tester la Beta avec un CSV
            </Button>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <Badge variant="secondary" className="mb-3"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Confidentialité</Badge>
            <h2 className="text-2xl font-bold mb-3">Vos données CRM restent privées</h2>
            <p className="text-sm text-muted-foreground">
              Votre fichier est associé uniquement à votre compte. Lotexpo utilise les sites web
              des entreprises pour rechercher des correspondances avec les exposants référencés.
              Vos données ne sont jamais affichées publiquement.
            </p>
          </div>
          <div className="space-y-3">
            <PrivacyPoint icon={<Eye className="h-4 w-4" />} text="Données visibles uniquement par vous" />
            <PrivacyPoint icon={<Globe className="h-4 w-4" />} text="Analyse basée sur le domaine web" />
            <PrivacyPoint icon={<EyeOff className="h-4 w-4" />} text="Aucun partage public de votre fichier" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-6">Questions fréquentes</h2>
        <Accordion type="single" collapsible className="w-full">
          <FaqItem v="q1" q="Quel format de fichier est accepté ?" a="Pour la Beta, Radar CRM accepte uniquement les fichiers CSV." />
          <FaqItem v="q2" q="Quelles colonnes sont nécessaires ?" a="Le fichier doit contenir au minimum le nom de l'entreprise et son site web." />
          <FaqItem v="q3" q="Comment fonctionne le matching ?" a="Lotexpo compare le domaine web des entreprises de votre fichier avec les domaines des exposants référencés sur la plateforme." />
          <FaqItem v="q4" q="Pourquoi certaines entreprises ne sont-elles pas détectées ?" a="Le matching Beta repose sur une correspondance exacte du domaine web. Certains groupes utilisant des sous-domaines ou des sites pays peuvent ne pas être détectés automatiquement." />
          <FaqItem v="q5" q="Puis-je connecter directement HubSpot ou Salesforce ?" a="Pas encore. Les connexions CRM directes sont prévues dans une prochaine étape. Pour le moment, vous pouvez tester Radar CRM avec un fichier CSV." />
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-4 py-12 mb-8">
        <div className="rounded-2xl bg-primary text-primary-foreground p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at top right, white, transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Prêt à transformer votre fichier CRM en opportunités salon ?
            </h2>
            <p className="text-sm md:text-base opacity-90 mb-6 max-w-2xl mx-auto">
              Importez votre CSV et découvrez immédiatement les événements où vos comptes sont présents.
            </p>
            <Button size="lg" variant="secondary" onClick={() => scrollToUpload('final_cta')}>
              <Upload className="h-4 w-4 mr-2" /> Importer mon fichier CSV
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

const BenefitCard: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="pt-6">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </CardContent>
  </Card>
);

const Step: React.FC<{ n: number; icon: React.ReactNode; title: string; text: string }> = ({ n, icon, title, text }) => (
  <div className="text-center p-5 rounded-lg border bg-card">
    <div className="mx-auto h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold mb-3">
      {n}
    </div>
    <div className="flex items-center justify-center gap-2 mb-1 text-primary">{icon}<span className="font-semibold text-foreground">{title}</span></div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

const TrustItem: React.FC<{ icon: React.ReactNode; label: string; sub: string }> = ({ icon, label, sub }) => (
  <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
    {icon}
    <div className="text-sm">
      <p className="font-medium leading-tight">{label}</p>
      <p className="text-muted-foreground text-xs">{sub}</p>
    </div>
  </div>
);

const FieldSelect: React.FC<{
  label: string;
  required?: boolean;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, required, headers, value, onChange }) => (
  <div className="space-y-1.5">
    <Label className="text-sm flex items-center gap-2">
      {label}
      {required && <Badge variant="secondary" className="text-[10px]">requis</Badge>}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Aucune colonne" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— Aucune —</SelectItem>
        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const StatTile: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`rounded-lg p-3 border ${accent ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
    <p className={`text-xl font-bold leading-none ${accent ? 'text-primary' : ''}`}>{value}</p>
    <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
  </div>
);

const CompanyRow: React.FC<{ name: string; stand: string }> = ({ name, stand }) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3 text-muted-foreground" /> {name}</span>
    <span className="font-mono text-muted-foreground">Stand {stand}</span>
  </div>
);

const ConnectorBadge: React.FC<{ name: string; status: string; available?: boolean }> = ({ name, status, available }) => (
  <div className={`rounded-lg border bg-card p-3 text-center ${available ? 'border-emerald-300 ring-1 ring-emerald-200' : ''}`}>
    <p className="font-semibold text-sm">{name}</p>
    <p className={`text-[11px] mt-1 ${available ? 'text-emerald-700' : 'text-muted-foreground'}`}>
      {available && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
      {status}
    </p>
  </div>
);

const PrivacyPoint: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
    <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
    <p className="text-sm font-medium">{text}</p>
  </div>
);

const FaqItem: React.FC<{ v: string; q: string; a: string }> = ({ v, q, a }) => (
  <AccordionItem value={v}>
    <AccordionTrigger className="text-left">{q}</AccordionTrigger>
    <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
  </AccordionItem>
);

export default RadarCrmPage;