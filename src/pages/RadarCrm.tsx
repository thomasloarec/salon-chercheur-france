import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import AccessRequestDialog from '@/components/radar-crm/AccessRequestDialog';
import {
  Radar, ArrowRight, Upload, FileCheck2, Lock, CheckCircle2, Mail,
  Compass, AlertTriangle, Briefcase, Check, X, Target,
  Sparkles, Eye, Globe, ClipboardList, Users, MessageCircle, HelpCircle, ListChecks,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import RadarCsvUploader from '@/components/radar-crm/RadarCsvUploader';
import RadarSpaceNameDialog from '@/components/radar-crm/RadarSpaceNameDialog';
import type { CrmSourceType } from '@/lib/radarCrm/parseFile';
import RadarPreviewTable from '@/components/radar-crm/RadarPreviewTable';
import MissionCardPreview from '@/components/radar-crm/previews/MissionCardPreview';
import ResultDashboardPreview from '@/components/radar-crm/previews/ResultDashboardPreview';
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
  sourceType: CrmSourceType;
  sheetName?: string;
}

const NONE = '__none__';
const PRIMARY_FIELDS: RadarField[] = ['company_name', 'website_raw'];
const ADVANCED_FIELDS: RadarField[] = ['crm_status', 'owner_name', 'owner_email', 'notes'];

const CANONICAL_URL = 'https://lotexpo.com/radar-crm';

// JSON-LD : présentation produit (SoftwareApplication) — schéma validé.
const SOFTWARE_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Radar CRM',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: CANONICAL_URL,
  description:
    "Radar CRM détecte les comptes de votre CRM présents comme exposants sur les prochains salons professionnels et prépare chaque visite : objectif de visite, phrase d'accroche et questions clés.",
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  provider: { '@type': 'Organization', name: 'Lotexpo', url: 'https://lotexpo.com' },
};

// FAQ — source unique : rendue à l'écran (section 11) ET en JSON-LD FAQPage.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Quelles colonnes faut-il dans mon fichier ?',
    a: "Le nom de l'entreprise et son site web. C'est tout. Un CSV ou un Excel avec ces deux colonnes suffit pour lancer l'analyse.",
  },
  {
    q: 'Comment fonctionne le matching ?',
    a: 'Radar CRM compare le domaine web de vos entreprises avec les exposants référencés sur Lotexpo. La correspondance est exacte, entreprise par entreprise, sans approximation.',
  },
  {
    q: 'Mes données sont-elles publiées quelque part ?',
    a: "Non, jamais. Votre fichier est lié à votre seul compte et sert uniquement à détecter les correspondances. Rien n'est affiché publiquement ni partagé.",
  },
  {
    q: "D'où vient la donnée salon ?",
    a: "De Lotexpo, qui centralise les salons professionnels en France et plus de 25 000 participations d'exposants. C'est cette donnée que votre CRM n'a pas.",
  },
  {
    q: "Je vais déjà sur les salons. Qu'est-ce que ça change ?",
    a: "Vous n'y allez plus sans objectif. Radar CRM vous prépare compte par compte (objectif, accroche, questions), puis vous aide à noter chaque échange et à faire avancer vos deals au retour.",
  },
  {
    q: 'Puis-je connecter HubSpot ou Salesforce ?',
    a: 'Bientôt. Les connexions natives (HubSpot, Salesforce, Pipedrive, Zoho) arriveront pour automatiser l\u2019analyse. Le CSV/Excel fonctionne déjà aujourd\u2019hui.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

const RadarCrmPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<RadarField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [privacyAck, setPrivacyAck] = useState(false);
  const autoSubmitRef = useRef(false);
  const resumedFromPendingRef = useRef(false);

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  // Après un import réussi : si l'espace de l'owner n'a pas encore de nom, on l'invite à le nommer.
  const [nameSpace, setNameSpace] = useState<{ accountId: string; importId: string } | null>(null);
  const [radarStatus, setRadarStatus] = useState<{
    status: string;
    has_access: boolean;
    loaded: boolean;
  }>({ status: 'none', has_access: false, loaded: false });

  const isRadarLocked = useMemo(() => {
    const lockedStatuses = ['trial_expired', 'free'];
    return radarStatus.loaded && lockedStatuses.includes(radarStatus.status);
  }, [radarStatus]);

  useEffect(() => {
    if (isRadarLocked) {
      setParsed(null);
      setMapping({});
      clearPendingImport();
    }
  }, [isRadarLocked]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRadarStatus({ status: 'none', has_access: false, loaded: true });
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await supabase.rpc('my_radar_status');
      if (!active) return;
      if (error || !data || data.length === 0) {
        setRadarStatus({ status: 'none', has_access: false, loaded: true });
      } else {
        const row = data[0];
        setRadarStatus({
          status: row.status ?? 'none',
          has_access: row.has_access ?? false,
          loaded: true,
        });
      }
    })();
    return () => { active = false; };
  }, [authLoading, user]);

  useEffect(() => {
    void trackRadarEvent('radar_page_viewed');
    void trackRadarEvent('radar_landing_viewed');
  }, []);

  const scrollToUpload = (source: string) => {
    void trackRadarEvent('radar_landing_cta_clicked', { source });
    document.getElementById('radar-upload')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPreview = () => {
    void trackRadarEvent('radar_landing_cta_clicked', { source: 'hero_secondary' });
    document.getElementById('apercu')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user || parsed) return;
    if (isRadarLocked) return;
    const pending = loadPendingImport();
    if (pending) {
      const headers = Object.keys(pending.rows[0] ?? {});
      setParsed({
        fileName: pending.fileName,
        headers,
        rows: pending.rows,
        sourceType: (pending as { sourceType?: CrmSourceType }).sourceType ?? 'csv',
        sheetName: (pending as { sheetName?: string }).sheetName,
      });
      setMapping(pending.mapping as Partial<Record<RadarField, string>>);
      resumedFromPendingRef.current = true;
    }
  }, [user, parsed, isRadarLocked]);

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
    try {
      savePendingImport({
        fileName: parsed.fileName,
        mapping: mapping as Record<string, string>,
        rows: parsed.rows,
        sourceType: parsed.sourceType,
        sheetName: parsed.sheetName,
      });
    } catch {
      toast({
        title: 'Fichier prêt',
        description: 'Connectez-vous pour lancer l’analyse. Si la reprise échoue, réimportez le fichier après connexion.',
      });
    }
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
        body: {
          fileName: parsed.fileName,
          sourceType: parsed.sourceType,
          mapping,
          rows: parsed.rows,
          sheetName: parsed.sheetName,
        },
      });
      if (error) throw error;
      const result = data as {
        importId?: string;
        matchesCount?: number;
        matchedCompaniesCount?: number;
        qualityWarning?: {
          suspiciousRate: number;
          threshold: number;
          suspicious: boolean;
          needsReviewCount: number;
        };
      };
      void trackRadarEvent('crm_import_completed', {
        importId: result.importId,
        matches: result.matchesCount,
        matchedCompanies: result.matchedCompaniesCount,
      });
      clearPendingImport();
      void queryClient.invalidateQueries({ queryKey: ['crm-event-matches', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['crm-latest-import-companies', user?.id] });
      toast({
        title: 'Analyse terminée',
        description: `${result.matchedCompaniesCount ?? 0} entreprise(s) détectée(s) sur des salons.`,
      });
      if (result.qualityWarning?.suspicious) {
        toast({
          title: 'Qualité du fichier à vérifier',
          description: `${result.qualityWarning.needsReviewCount} correspondance(s) suspecte(s) (${Math.round(result.qualityWarning.suspiciousRate * 100)}%). Vérifiez que le nom d'entreprise est bien dans la bonne colonne.`,
          variant: 'destructive',
        });
      }
      // Si l'owner n'a pas encore nommé son espace, on l'invite avant de basculer vers les résultats.
      const teamRes = await supabase.rpc('get_my_radar_team');
      const team = teamRes.data as unknown as { account_id?: string; my_role?: string; org_name?: string | null } | null;
      if (team && team.my_role === 'owner' && !(team.org_name ?? '').trim() && team.account_id) {
        setNameSpace({ accountId: team.account_id, importId: result.importId ?? '' });
        return;
      }
      navigate(`/radar-crm/results?importId=${result.importId ?? ''}`);
    } catch (err) {
      let isTrialExpired = false;
      if (err && typeof err === 'object' && 'context' in err) {
        const ctx = (err as { context?: Response }).context;
        if (ctx && ctx.status === 403) {
          try {
            const body = (await ctx.json()) as { error?: string; message?: string };
            if (body?.error === 'TRIAL_EXPIRED') isTrialExpired = true;
          } catch { /* ignore body parse errors */ }
        }
      }
      if (isTrialExpired) {
        setRadarStatus((prev) => ({ ...prev, status: 'trial_expired', has_access: false, loaded: true }));
        setParsed(null);
        setMapping({});
        clearPendingImport();
        toast({
          title: 'Essai terminé',
          description: "Vous ne pouvez plus importer de nouveau fichier. Demandez l'accès pour continuer.",
          variant: 'destructive',
        });
        return;
      }
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

  // Auto-launch the analysis after returning from auth with a pending import
  useEffect(() => {
    if (autoSubmitRef.current) return;
    if (!radarStatus.loaded || isRadarLocked) return;
    if (!user || !parsed || submitting) return;
    if (!resumedFromPendingRef.current) return;
    if (missingRequired.length > 0) return;
    autoSubmitRef.current = true;
    void handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, parsed, mapping, submitting, missingRequired.length, radarStatus.loaded, isRadarLocked]);

  return (
    <MainLayout
      title="Radar CRM — préparez chaque visite salon"
      description="Radar CRM repère les comptes de votre CRM qui exposent sur les prochains salons et prépare chaque visite : objectif, phrase d'accroche et 3 questions clés."
      canonical={CANONICAL_URL}
    >
      <Helmet>
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL_URL} />
        <script type="application/ld+json">{JSON.stringify(SOFTWARE_APP_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
      </Helmet>

      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))' }}
        />
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid lg:grid-cols-[55fr_45fr] gap-10 items-center">
          <div className="animate-fade-in-up">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
              Pour les commerciaux qui vont sur les salons
            </p>
            <h1 className="heading-display text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 leading-tight">
              Arrivez sur le salon en sachant exactement qui voir, pourquoi, et quoi lui dire.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8">
              Radar CRM repère les comptes de votre CRM qui exposent, et prépare chaque visite à votre
              place : un objectif, une phrase pour engager, les 3 bonnes questions. Comme si un
              commercial de 20 ans qui connaît votre métier faisait le travail avant vous.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <Button
                size="lg"
                onClick={() => scrollToUpload('hero_primary')}
                className="w-full sm:w-auto h-auto py-3 whitespace-normal text-center"
              >
                <Upload className="h-4 w-4 mr-2 shrink-0" /> Analyser mon fichier CRM
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={scrollToPreview}
                className="w-full sm:w-auto h-auto py-3 whitespace-normal text-center"
              >
                Voir à quoi ça ressemble
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Analyse privée · vos données restent à vous · 2 colonnes suffisent (nom + site web)
            </p>
          </div>

          {/* Aperçu carte de mission — miroir présentationnel du vrai Radar CRM */}
          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent rounded-3xl blur-2xl -z-10" />
            <MissionCardPreview big />
          </div>
        </div>
      </section>

      {/* 2. Le vrai problème (navy) */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Le vrai problème</p>
            <h2 className="heading-display text-2xl md:text-4xl mb-5">
              Ce n’est pas d’aller sur le salon. C’est d’y aller sans objectif.
            </h2>
            <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">
              Vous bloquez deux jours. Vous payez le déplacement, le badge, l’hôtel. Et vous arrivez
              sans liste, sans priorité. Alors vous marchez dans les allées, vous parlez à qui est
              disponible, vous repartez avec des cartes. Le soir, on vous demande « ça a donné quoi ? »
              — et vous n’avez rien de concret à répondre. Le pire, c’est que vous le sentiez venir
              avant même de partir.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            <PainCard
              icon={<Compass className="h-5 w-5" />}
              title="Vous naviguez à l’intuition"
              text="Sans liste de comptes prioritaires, vous découvrez le salon en le parcourant. Les bonnes rencontres tiennent à la chance."
            />
            <PainCard
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Vous figez devant un compte clé"
              text="Vous tombez sur une entreprise qui compte, sans objectif, sans angle, sans question préparée. L’occasion passe."
            />
            <PainCard
              icon={<Briefcase className="h-5 w-5" />}
              title="Vous rentrez les mains vides"
              text="Beaucoup de pas, quelques cartes, aucun deal qui a bougé. Le salon devient un coût, pas un investissement."
            />
          </div>
        </div>
      </section>

      {/* 3. Le basculement (avant / après) */}
      <section className="max-w-6xl mx-auto px-4 py-14 md:py-20">
        <div className="max-w-3xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Le basculement</p>
          <h2 className="heading-display text-2xl md:text-3xl mb-3 section-rule">
            La différence entre un salon subi et un salon rentable ? Un objectif par compte.
          </h2>
          <p className="text-base text-muted-foreground">
            Le moment où vous savez quoi faire de chaque rencontre, tout change. C’est là que Radar CRM
            entre en jeu.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60 shadow-none bg-muted/20">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Sans Radar CRM</h3>
              <ul className="space-y-3">
                {[
                  'Vous errez dans les allées',
                  'Vous parlez à qui vous croisez',
                  'Vous notez sur un coin de carnet (ou pas)',
                  'Vous repartez avec une pile de cartes',
                  'Personne ne sait quoi en faire',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <X className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-secondary/30 shadow-sm">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground">Avec Radar CRM</h3>
              <ul className="space-y-3">
                {[
                  'Vous savez qui voir en priorité',
                  'Un objectif et une accroche par compte',
                  'Vous dictez chaque échange en sortant du stand',
                  'Vous repartez avec des deals qui ont avancé',
                  'Le suivi est déjà prêt',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4. Ce que fait Radar CRM, maintenant (timeline) */}
      <section className="bg-muted/20 border-y border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-20">
          <div className="max-w-3xl mb-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
              Ce que fait Radar CRM, maintenant
            </p>
            <h2 className="heading-display text-2xl md:text-3xl mb-3 section-rule">
              Du plan de visite jusqu’au deal qui avance.
            </h2>
            <p className="text-base text-muted-foreground">
              Avant, Radar CRM vous disait seulement où étaient vos comptes. Aujourd’hui, il vous
              accompagne à chaque étape du salon.
            </p>
          </div>

          <ol className="relative space-y-8 md:space-y-10">
            <PhaseRow
              n={1}
              phase="Avant le salon"
              icon={<Target className="h-4 w-4" />}
              title="Un objectif par compte, sans le préparer."
              text="Radar CRM analyse votre offre et votre relation avec chaque entreprise — client, prospect, partenaire ou concurrent — puis génère pour chacune un objectif de visite, une phrase pour engager la conversation, et le TOP 3 des questions à poser. Une PME technique et un grand groupe n’appellent pas les mêmes questions : Radar CRM ajuste selon la taille et la personne que vous aurez en face."
              chips={['Objectif de visite', 'Phrase d’accroche', 'Top 3 questions']}
            />
            <PhaseRow
              n={2}
              phase="Pendant le salon"
              icon={<Radar className="h-4 w-4" />}
              title="Le mode terrain. Mains libres, rien ne se perd."
              text="Sur place, vous avez votre liste de priorités et votre checklist de visite. Vous sortez d’un stand ? Vous dictez ce qui s’est dit. L’IA transcrit, résume, et transforme l’échange en tâches de suivi. Fini les infos griffonnées puis oubliées dans le bruit du salon."
              chips={['Note vocale', 'Résumé automatique', 'Tâches de suivi']}
            />
            <PhaseRow
              n={3}
              phase="Après le salon"
              icon={<ClipboardList className="h-4 w-4" />}
              title="Le débrief qui fait avancer les deals."
              text="Chaque conversation devient une action concrète. Vos deals existants avancent d’une étape, vos nouveaux contacts sont relancés au bon moment. Vous exportez tout, prêt à réintégrer dans votre CRM."
              chips={['Débrief guidé', 'Deals avancés', 'Export CSV']}
              last
            />
          </ol>

          {/* Bandeau bonus (peach) */}
          <div className="mt-10 rounded-2xl bg-secondary text-secondary-foreground p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className="h-10 w-10 shrink-0 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-lg mb-1">Et des comptes que vous ne suiviez pas encore.</h3>
                <p className="text-sm text-secondary-foreground/80">
                  Radar CRM repère aussi des entreprises qui ressemblent à vos meilleurs clients et qui
                  exposent. De nouveaux prospects, détectés pour vous.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Positionnement (navy centré) */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 py-14 md:py-20 text-center">
          <h2 className="heading-display text-2xl md:text-3xl mb-4">
            Pas besoin d’être un crack de la vente.
          </h2>
          <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">
            L’idée n’est pas de vous transformer en négociateur d’élite. C’est de vous donner, sur
            chaque compte, le plan qu’un commercial de 20 ans qui connaît votre secteur vous aurait
            soufflé. Vous suivez le plan. Radar CRM apporte l’expertise.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Le besoin d’abord · le talent commercial ensuite
          </p>
        </div>
      </section>

      {/* 5b. Votre visite n'est plus une improvisation */}
      <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl mb-8">
          <h2 className="heading-display text-xl md:text-2xl mb-3">
            Votre visite n’est plus une improvisation
          </h2>
          <p className="text-base text-muted-foreground">
            Radar CRM ne vous donne pas seulement une liste d’entreprises présentes sur un salon. Il prépare les décisions qui font la différence entre une visite au hasard et une visite commerciale utile.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-lg border bg-card">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Qui aller voir en priorité</h3>
            <p className="text-sm text-muted-foreground">
              Radar CRM identifie les comptes de votre fichier présents sur le salon et met en avant ceux qui méritent votre attention.
            </p>
          </div>
          <div className="p-5 rounded-lg border bg-card">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
              <MessageCircle className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Comment ouvrir la discussion</h3>
            <p className="text-sm text-muted-foreground">
              Chaque compte peut être accompagné d’une phrase d’accroche adaptée pour engager la conversation sans arriver à froid.
            </p>
          </div>
          <div className="p-5 rounded-lg border bg-card">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
              <HelpCircle className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Quelles questions poser</h3>
            <p className="text-sm text-muted-foreground">
              Vous arrivez devant le stand avec les bonnes questions pour comprendre le besoin, qualifier l’opportunité et faire avancer l’échange.
            </p>
          </div>
          <div className="p-5 rounded-lg border bg-card">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
              <ListChecks className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Comment assurer le suivi</h3>
            <p className="text-sm text-muted-foreground">
              Vos notes de visite deviennent des résumés, tâches et actions de relance exploitables après le salon.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Aperçu d'un résultat (dashboard) */}
      <section id="apercu" className="max-w-5xl mx-auto px-4 py-14 md:py-20 scroll-mt-24">
        <div className="max-w-3xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Aperçu d’un résultat</p>
          <h2 className="heading-display text-2xl md:text-3xl mb-3 section-rule">
            Votre CRM, transformé en plan de visite.
          </h2>
          <p className="text-base text-muted-foreground">
            Un fichier d’entreprises entre. Un plan d’action salon en sort — avec un objectif sur chaque
            compte.
          </p>
        </div>
        {/* Miroir présentationnel de la vue résultat du vrai Radar CRM */}
        <ResultDashboardPreview />
      </section>

      {/* 7. Comment ça marche */}
      <section className="bg-muted/20 border-y border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-20">
          <div className="max-w-3xl mb-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Comment ça marche</p>
            <h2 className="heading-display text-2xl md:text-3xl section-rule">
              Trois étapes. La première prend deux minutes.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard n={1} title="Importez votre CRM" text="Un CSV ou un Excel avec deux colonnes : nom de l’entreprise et site web. Aucune connexion à installer." />
            <StepCard n={2} title="Radar CRM détecte et prépare" text="Matching par domaine web, puis génération d’un objectif, d’une accroche et des bonnes questions pour chaque compte présent." />
            <StepCard n={3} title="Vous arrivez avec un plan" text="Priorités, mode terrain, débrief. Vous repartez du salon avec des deals qui ont avancé et de nouveaux prospects engagés." />
          </div>
        </div>
      </section>

      {/* 8. Confidentialité */}
      <section className="max-w-5xl mx-auto px-4 py-14 md:py-20">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Confidentialité</p>
            <h2 className="heading-display text-2xl md:text-3xl mb-3 section-rule">
              Vos données CRM restent privées.
            </h2>
            <p className="text-base text-muted-foreground">
              Votre fichier est lié à votre seul compte et sert uniquement à détecter les
              correspondances avec les exposants référencés sur Lotexpo. Il n’est jamais affiché
              publiquement.
            </p>
          </div>
          <div className="space-y-3">
            <PrivacyPoint icon={<Eye className="h-4 w-4" />} title="Visibles uniquement par vous" sub="Aucune donnée n’est partagée ni publiée." />
            <PrivacyPoint icon={<Globe className="h-4 w-4" />} title="Analyse basée sur le domaine web" sub="Correspondance exacte, entreprise par entreprise." />
            <PrivacyPoint icon={<FileCheck2 className="h-4 w-4" />} title="Deux colonnes suffisent" sub="Nom + site web. Formats CSV ou XLSX." />
          </div>
        </div>
      </section>

      {/* 9. Connecteurs */}
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/5 p-8 md:p-10">
          <div className="max-w-3xl mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Démarrez tout de suite</p>
            <h2 className="heading-display text-2xl md:text-3xl mb-3 section-rule">
              Commencez sans connecter votre CRM.
            </h2>
            <p className="text-base text-muted-foreground">
              Le CSV/Excel fonctionne dès maintenant. Les connexions natives arrivent pour automatiser
              l’analyse.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ConnectorBadge name="CSV / Excel" status="Disponible" available />
            <ConnectorBadge name="HubSpot" status="Bientôt" />
            <ConnectorBadge name="Salesforce" status="Bientôt" />
            <ConnectorBadge name="Pipedrive" status="Bientôt" />
            <ConnectorBadge name="Zoho CRM" status="Bientôt" />
          </div>
        </div>
      </section>

      {/* 10. CTA final + zone d'import */}
      <section className="max-w-5xl mx-auto px-4 pt-8 md:pt-12">
        <div className="rounded-2xl bg-primary text-primary-foreground p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at top right, hsl(var(--accent)), transparent 60%)' }} />
          <div className="relative">
            <h2 className="heading-display text-2xl md:text-3xl mb-3">
              Votre prochain salon peut être le plus rentable de l’année. Ou deux jours de perdus.
            </h2>
            <p className="text-sm md:text-base text-primary-foreground/80 mb-6 max-w-2xl mx-auto">
              La seule différence, c’est d’y arriver avec un objectif. Importez votre fichier — Radar CRM
              s’occupe du reste.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => scrollToUpload('final_cta')}
              className="w-full sm:w-auto h-auto py-3 whitespace-normal text-center"
            >
              <Upload className="h-4 w-4 mr-2 shrink-0" /> Analyser mon fichier CRM
            </Button>
          </div>
        </div>
      </section>

      {/* Zone d'import réelle (upload + mapping + auth-gate) — logique inchangée */}
      <section id="radar-upload" className="max-w-4xl mx-auto px-4 py-10 scroll-mt-24">
        {!radarStatus.loaded && user && (
          <Card className="border border-border bg-muted/20">
            <CardContent className="pt-6 text-center">
              <Radar className="h-8 w-8 mx-auto mb-3 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Vérification de votre accès Radar CRM…</p>
            </CardContent>
          </Card>
        )}

        {radarStatus.loaded && isRadarLocked && (
          <TrialExpiredCard onOpenRequest={() => setRequestDialogOpen(true)} />
        )}

        {radarStatus.loaded && !isRadarLocked && !parsed && (
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="text-center mb-5">
                <h3 className="text-xl font-semibold mb-1">Testez Radar CRM avec un simple fichier CSV ou Excel</h3>
                <p className="text-sm text-muted-foreground">
                  Deux colonnes suffisent : nom de l'entreprise et site web. Votre fichier reste privé
                  et sert uniquement à détecter les correspondances avec les exposants référencés sur Lotexpo.
                </p>
              </div>
              <RadarCsvUploader onParsed={onParsed} />
            </CardContent>
          </Card>
        )}

        {radarStatus.loaded && !isRadarLocked && parsed && (
          <div className="space-y-6" id="radar-mapping">
            {/* File summary */}
            <Card className="bg-card">
              <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileCheck2 className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{parsed.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsed.sourceType === 'excel' ? 'Excel' : 'CSV'}
                      {parsed.sheetName ? ` · Feuille : ${parsed.sheetName}` : ''}
                      {' · '}
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
              <Card className="border-primary/30 bg-muted">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 mt-0.5 text-foreground" />
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
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm text-foreground/80">
                    En lançant l'analyse, vous autorisez Lotexpo à traiter les entreprises et sites web de ce fichier afin de détecter les salons où ces entreprises exposent. Vos données Radar CRM restent privées et peuvent être supprimées à tout moment depuis vos paramètres Radar CRM.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    En utilisant Radar CRM, vous recevrez par défaut des alertes email lorsque de nouvelles opportunités sont détectées. Vous pourrez les désactiver à tout moment dans les Paramètres Radar CRM.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={privacyAck}
                      onCheckedChange={(v) => {
                        const next = v === true;
                        setPrivacyAck(next);
                        if (next) void trackRadarEvent('radar_privacy_notice_acknowledged', { source: 'radar_crm' });
                      }}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      J'ai compris que ce fichier sera utilisé pour générer mon Radar CRM.
                    </span>
                  </label>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    onClick={() => {
                      if (!privacyAck) {
                        toast({ title: 'Veuillez confirmer', description: "Cochez la case pour autoriser l'analyse de votre fichier." });
                        return;
                      }
                      void handleSubmit();
                    }}
                    disabled={submitting || missingRequired.length > 0 || !privacyAck}
                    size="lg"
                    className="w-full sm:w-auto py-3"
                  >
                    <Radar className="mr-2 h-4 w-4" />
                    {submitting ? 'Analyse en cours…' : "Lancer l'analyse Radar CRM"}
                  </Button>
                  {!privacyAck && (
                    <p className="text-xs text-muted-foreground">Cochez la case ci-dessus pour activer l'analyse.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 11. FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-14 md:py-20">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Questions fréquentes</p>
          <h2 className="heading-display text-2xl md:text-3xl section-rule">Ce qu’on nous demande le plus.</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* 12. CTA final */}
      <section className="max-w-5xl mx-auto px-4 pb-14 md:pb-20">
        <div className="rounded-2xl bg-primary text-primary-foreground p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at top right, hsl(var(--accent)), transparent 60%)' }} />
          <div className="relative">
            <h2 className="heading-display text-2xl md:text-3xl mb-3">
              Votre prochaine visite salon peut faire avancer vos comptes.
            </h2>
            <p className="text-sm md:text-base text-primary-foreground/80 mb-6 max-w-2xl mx-auto">
              Importez votre CRM. Radar CRM vous aide à savoir quels salons et stands visiter, pourquoi engager la discussion, quoi demander et comment relancer après chaque échange.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => scrollToUpload('final_cta')}
              className="w-full sm:w-auto h-auto py-3 whitespace-normal text-center"
            >
              <Upload className="h-4 w-4 mr-2 shrink-0" /> Analyser mon fichier CRM
            </Button>
          </div>
        </div>
      </section>

      <AccessRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        source="locked_upload"
      />

      <RadarSpaceNameDialog
        open={nameSpace !== null}
        accountId={nameSpace?.accountId ?? null}
        onClose={() => {
          const importId = nameSpace?.importId ?? '';
          setNameSpace(null);
          navigate(`/radar-crm/results?importId=${importId}`);
        }}
      />
    </MainLayout>
  );
};

/* ── Présentation (helpers de section) ─────────────────────────────── */

const PainCard: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-5">
    <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-3">
      {icon}
    </div>
    <h3 className="font-semibold mb-1 text-primary-foreground">{title}</h3>
    <p className="text-sm text-primary-foreground/70">{text}</p>
  </div>
);

const PhaseRow: React.FC<{
  n: number; phase: string; icon: React.ReactNode; title: string; text: string; chips: string[]; last?: boolean;
}> = ({ n, phase, icon, title, text, chips, last }) => (
  <li className="relative flex gap-4 md:gap-6">
    <div className="flex flex-col items-center">
      <span className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-semibold shadow-sm">
        {n}
      </span>
      {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
    </div>
    <div className={last ? '' : 'pb-2'}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">
        {icon}<span>{phase}</span>
      </div>
      <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{text}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {chips.map((c) => (
          <span key={c} className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
            {c}
          </span>
        ))}
      </div>
    </div>
  </li>
);

const StepCard: React.FC<{ n: number; title: string; text: string }> = ({ n, title, text }) => (
  <div className="p-5 rounded-lg border bg-card">
    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-semibold mb-3">
      {n}
    </div>
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

const PrivacyPoint: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
    <div className="h-9 w-9 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
    <div>
      <h3 className="text-sm font-semibold leading-tight">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  </div>
);

const ConnectorBadge: React.FC<{ name: string; status: string; available?: boolean }> = ({ name, status, available }) => (
  <div className={`rounded-lg border bg-card p-3 text-center ${available ? 'border-primary/40 ring-1 ring-primary/20' : ''}`}>
    <p className="font-semibold text-sm">{name}</p>
    <p className={`text-[11px] mt-1 ${available ? 'text-primary' : 'text-muted-foreground'}`}>
      {available && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
      {status}
    </p>
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

const TrialExpiredCard: React.FC<{ onOpenRequest: () => void }> = ({ onOpenRequest }) => (
  <Card className="border border-destructive/20 bg-destructive/5">
    <CardContent className="pt-8 pb-8 text-center space-y-5">
      <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <Lock className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h3 className="text-xl font-semibold">Votre essai Radar CRM est terminé</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Vous ne pouvez plus importer de nouveau fichier. Contactez-nous pour activer Radar CRM en Premium.
        </p>
      </div>
      <Button onClick={onOpenRequest} size="lg">
        <Mail className="h-4 w-4 mr-2" /> Demander l'accès
      </Button>
    </CardContent>
  </Card>
);

export default RadarCrmPage;
