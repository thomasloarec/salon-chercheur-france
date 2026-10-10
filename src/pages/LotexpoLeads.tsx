import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  WifiOff, ScanText, Mic, Users, Target, Sparkles, BarChart3, Download,
  Contact, BrainCircuit, EyeOff, Check, type LucideIcon,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Reveal } from '@/components/ui/reveal';
import { CountUp } from '@/components/ui/count-up';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import PhoneMockup, { ActionPhone, SavedPhone } from '@/components/lotexpo-leads/PhoneMockup';
import LeadsPricingCards from '@/components/lotexpo-leads/LeadsPricingCards';
import { joinBeta, manageLink } from '@/components/lotexpo-leads/joinBeta';
import { useAuth } from '@/contexts/AuthContext';
import { useMyExhibitors } from '@/hooks/useMyExhibitors';
import { useBoothContext } from '@/hooks/useBoothContext';
import { cn } from '@/lib/utils';

const CANONICAL = 'https://lotexpo.com/lotexpo-leads';
const TITLE = 'Lotexpo Leads : capture de leads sur salon, hors réseau et avec IA | Lotexpo';
const DESCRIPTION = 'Scannez badges et cartes de visite, dictez vos rencontres et suivez vos leads de salon avec votre équipe, même sans réseau. Bêta gratuite.';

const PRIMARY = 'h-[54px] rounded-xl px-6 text-base font-medium shadow-none';
const SECONDARY = 'h-[54px] rounded-xl px-6 text-base font-medium';
const CARD = 'rounded-2xl border border-border bg-card p-6 shadow-sm';

const PROBLEMS = [
  { icon: Contact, t: 'Les contacts se perdent', d: 'Cartes au fond d\'un sac, notes sur un carnet, photos sur trois téléphones différents.' },
  { icon: BrainCircuit, t: 'Le contexte s\'oublie', d: 'Le lundi suivant, plus personne ne sait qui avait un projet, ni ce qui avait été promis.' },
  { icon: EyeOff, t: 'Le manager pilote à l\'aveugle', d: 'Aucun chiffre pendant le salon, un bilan approximatif après, et un coût par contact inconnu.' },
];

const STEPS = [
  { t: 'Capturer', d: 'Badge QR du salon, photo de la carte de visite lue par l\'IA, ou dictée de 20 secondes : la fiche se remplit toute seule. Sans réseau, tout est gardé sur le téléphone et envoyé au retour du réseau.' },
  { t: 'Qualifier', d: 'Une question à la fois : relation, potentiel, projet chiffré, prochaine action et échéance. Le commercial répond d\'un pouce, entre deux visiteurs.' },
  { t: 'Suivre', d: 'Actions à faire, débrief du jour avec synthèse IA, bilan du salon avec coût par contact et projets, export pour votre CRM.' },
];

const FEATURES: { icon: LucideIcon; t: string; d: string }[] = [
  { icon: WifiOff, t: 'Hors réseau', d: 'Les halls captent mal : la saisie continue et se synchronise toute seule.' },
  { icon: ScanText, t: 'Lecture de cartes par IA', d: 'Une photo, et nom, entreprise, email, téléphone sont proposés à vérifier.' },
  { icon: Mic, t: 'Dictée', d: 'Racontez la rencontre : la fiche, le potentiel et l\'action sont pré-remplis.' },
  { icon: Users, t: 'Équipe en direct', d: 'Le manager voit les rencontres de chacun pendant le salon.' },
  { icon: Target, t: 'Objectif du jour', d: 'Un objectif d\'équipe et une progression visible pour garder le rythme.' },
  { icon: Sparkles, t: 'Synthèse IA du débrief', d: 'Priorités, relances et signaux du jour en un résumé.' },
  { icon: BarChart3, t: 'Bilan et coût par contact', d: 'Projets estimés, rencontres utiles, comparaison entre salons.' },
  { icon: Download, t: 'Export', d: 'Toutes les rencontres en un fichier, prêt pour votre CRM.' },
];

const FAQ = [
  { q: 'Faut-il installer une application ?', a: 'Non. Lotexpo Leads s\'ouvre dans le navigateur du téléphone et peut être ajouté à l\'écran d\'accueil. Il fonctionne ensuite sans réseau.' },
  { q: 'Combien de personnes peuvent l\'utiliser ?', a: 'Avec le plan Gratuit, un seul utilisateur : l\'administrateur de votre fiche exposant. Avec le Pass salon ou l\'Annuel, jusqu\'à 15 utilisateurs : vous invitez les commerciaux du stand, chacun voit ses rencontres, le manager voit celles de toute l\'équipe.' },
  { q: 'Où vont mes données ?', a: 'Elles appartiennent à votre entreprise et ne sont visibles que par votre équipe. Les enregistrements de dictée ne sont jamais conservés.' },
  { q: 'Et mon CRM ?', a: 'Vous exportez toutes les rencontres en un fichier, prêt à importer dans votre CRM.' },
  { q: 'Comment rejoindre la bêta ?', a: 'Depuis votre espace exposant Lotexpo, demandez l\'accès. Nous l\'ouvrons rapidement et vous aidons à préparer votre premier salon.' },
];

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

function SectionHead({ over, title, light }: { over?: string; title: string; light?: boolean }) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center">
      {over && <p className={cn('mb-2 text-sm font-medium', light ? 'text-inverse-primary' : 'text-primary-deep')}>{over}</p>}
      <h2 className={cn('text-2xl font-semibold leading-tight md:text-3xl', light && 'text-inverse')}>{title}</h2>
    </div>
  );
}

export default function LotexpoLeads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: memberships = [] } = useMyExhibitors();
  const { data: boothItems = [] } = useBoothContext();
  const [dialog, setDialog] = useState<'choose' | 'claim' | null>(null);

  const fiches = useMemo(
    () => memberships.filter((m) => (m.role === 'owner' || m.role === 'admin') && m.status === 'active' && m.exhibitor?.slug),
    [memberships],
  );
  const hasLeadsAccess = boothItems.some((i) => !!i.role);
  const ctaLabel = hasLeadsAccess ? 'Ouvrir Lotexpo Leads' : 'Rejoindre la bêta gratuite';
  const returnedForBeta = location.hash === '#beta' && !!user;

  useEffect(() => {
    if (location.hash !== '#beta') return;
    const t = window.setTimeout(() => document.getElementById('tarifs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  const onJoin = () => {
    const r = joinBeta({ loggedIn: !!user, hasLeadsAccess, exhibitorSlugs: fiches.map((f) => f.exhibitor.slug as string) });
    if (r.kind === 'choose' || r.kind === 'claim') setDialog(r.kind);
    else navigate(r.to);
  };

  return (
    <MainLayout title={TITLE} rawTitle description={DESCRIPTION} canonical={CANONICAL}>
      <Helmet>
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(FAQ_LD)}</script>
      </Helmet>

      <div className="-mx-6">
        {/* 1. Hero */}
        <section className="relative isolate bg-background px-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: "url('/backgrounds/recherche-ia-bg.jpg')" }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-10 py-12 md:py-20 lg:min-h-[calc(100vh-64px)] lg:grid-cols-2 lg:py-0">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-2 pr-4 text-sm font-semibold text-primary shadow-sm">
                <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-primary-foreground">Bêta</span>
                Lotexpo Leads · capture de leads sur salon
              </span>
              <h1 className="heading-display mt-5 text-balance text-[clamp(1.9rem,3.6vw,3.3rem)]">
                Chaque rencontre sur votre stand, <span className="block text-primary">enregistrée en 20 secondes.</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                Scannez un badge, photographiez une carte de visite ou dictez la conversation. Lotexpo Leads remplit la fiche, rappelle la prochaine action et donne au manager le bilan du salon en direct. Même sans réseau.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button className={PRIMARY} onClick={onJoin}>{ctaLabel}</Button>
                <Button asChild variant="outline" className={SECONDARY}>
                  <a href="#comment">Voir comment ça marche</a>
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {['Sans application à installer', 'iPhone et Android', 'Fonctionne hors réseau'].map((m, i) => (
                  <React.Fragment key={m}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                      {m}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </Reveal>
            <Reveal delay={150}>
              <PhoneMockup />
            </Reveal>
          </div>
        </section>

        {/* 2. Chiffres */}
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-11">
            <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.14em] text-primary">Pensé pour le stand, pas pour le bureau</p>
            <div className="grid w-full max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
              {[
                { node: <><CountUp target={20} format={(v) => String(v)} /> s</>, lbl: 'pour enregistrer une rencontre' },
                { node: '0 réseau', lbl: 'nécessaire pendant le salon' },
                { node: '1 prix', lbl: 'par salon pour toute l\'équipe' },
              ].map((c, i) => (
                <Reveal
                  key={c.lbl}
                  delay={i * 80}
                  className={cn('text-center sm:relative', i < 2 && 'sm:after:absolute sm:after:-right-5 sm:after:top-[12%] sm:after:h-[76%] sm:after:w-px sm:after:bg-border sm:after:content-[""]')}
                >
                  <div className="heading-display text-[clamp(2rem,3.4vw,2.9rem)] leading-none text-primary">{c.node}</div>
                  <div className="mt-2.5 font-medium leading-snug text-muted-foreground">{c.lbl}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Problème */}
        <section className="relative overflow-hidden bg-surface-inverse px-6 py-24 text-inverse">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'url(/home-texture-plexus.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.28 }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))' }} />
          <div className="relative mx-auto max-w-6xl">
            <Reveal>
              <div className="mx-auto mb-5 h-[3px] w-[46px] rounded-full bg-inverse-primary" />
              <SectionHead light title="Un salon coûte des milliers d'euros. Ce qui en reste tient trop souvent dans une pile de cartes de visite." />
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {PROBLEMS.map(({ icon: I, t, d }, i) => (
                <Reveal key={t} delay={i * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6">
                    <I className="h-6 w-6 text-inverse-primary" strokeWidth={1.5} aria-hidden="true" />
                    <h3 className="mt-3 text-lg font-semibold text-inverse">{t}</h3>
                    <p className="mt-1.5 text-inverse/75">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Comment ça marche */}
        <section id="comment" className="scroll-mt-20 bg-background px-6 py-14 md:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal><SectionHead over="Comment ça marche" title="Trois gestes, du stand jusqu'au bilan." /></Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.t} delay={i * 80} className="h-full">
                  <div className={cn(CARD, 'h-full')}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-booth-good-bg font-semibold text-primary-deep">{i + 1}</span>
                    <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                    <p className="mt-1.5 text-muted-foreground">{s.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-10 hidden justify-center gap-10 lg:flex">
              <ActionPhone />
              <SavedPhone />
            </div>
          </div>
        </section>

        {/* 5. Fonctions */}
        <section className="relative overflow-hidden bg-booth-navy px-6 py-14 md:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'url(/home-texture-light.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.35 }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))' }} />
          <div className="relative mx-auto max-w-6xl">
            <Reveal><SectionHead light title="Tout ce qu'il faut sur le stand, rien de plus." /></Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: I, t, d }, i) => (
                <Reveal key={t} delay={(i % 4) * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-booth-goal-track bg-booth-navy-card p-5">
                    <I className="h-6 w-6 text-booth-sky-text" strokeWidth={1.5} aria-hidden="true" />
                    <h3 className="mt-3 font-semibold text-inverse">{t}</h3>
                    <p className="mt-1 text-sm text-booth-on-navy">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Tarifs */}
        <section id="tarifs" className="scroll-mt-20 bg-background px-6 py-14 md:py-20">
          <span id="beta" className="block scroll-mt-20" />
          <Reveal className="mx-auto max-w-6xl">
            <SectionHead over="Tarifs" title="Payez le salon, pas chaque commercial." />
            <p className="mx-auto -mt-4 mb-8 max-w-2xl text-center text-muted-foreground">
              Les loueurs de scanners facturent en général chaque licence, salon par salon. Ici, un prix par salon pour toute l'équipe.
            </p>
            <div className="mb-8 flex flex-col items-start gap-4 rounded-2xl border border-booth-beta-line bg-booth-beta-bg p-5 text-success-deep md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">Bêta en cours : toutes les fonctions sont offertes aux premiers exposants, sans carte bancaire.</p>
                {returnedForBeta && !hasLeadsAccess && fiches.length > 1 && (
                  <p className="mt-1 text-sm">Choisissez votre fiche exposant pour demander l'accès.</p>
                )}
              </div>
              <Button onClick={onJoin} className="h-11 min-h-[44px] shrink-0 rounded-xl bg-success-deep px-5 text-background shadow-none hover:bg-success-deep/90">
                {hasLeadsAccess ? 'Ouvrir Lotexpo Leads' : 'Rejoindre la bêta'}
              </Button>
            </div>
            <LeadsPricingCards onJoin={onJoin} ctaLabel={ctaLabel} hasLeadsAccess={hasLeadsAccess} />
          </Reveal>
        </section>

        {/* 6. FAQ */}
        <section className="bg-booth-canvas px-6 py-14 md:py-20">
          <Reveal className="mx-auto max-w-3xl">
            <SectionHead title="Questions fréquentes" />
            <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5">
              {FAQ.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`} className={i === FAQ.length - 1 ? 'border-b-0' : undefined}>
                  <AccordionTrigger className="min-h-[44px] text-left font-medium">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        {/* 7. Appel final */}
        <section className="relative overflow-hidden px-6 py-24 text-center text-primary-foreground" style={{ background: 'linear-gradient(160deg, hsl(var(--primary)), hsl(218 95% 14%))' }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'url(/home-texture-final.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3 }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 70% at 50% 50%, hsl(var(--primary) / 0.55), hsl(218 95% 14% / 0.9))' }} />
          <Reveal className="relative z-10 mx-auto max-w-2xl">
            <h2 className="heading-display text-3xl text-primary-foreground md:text-4xl">Votre prochain salon mérite mieux qu'une pile de cartes.</h2>
            <p className="mt-4 text-lg text-primary-foreground/80">Rejoignez la bêta : nous ouvrons votre accès et vous accompagnons pour votre premier salon.</p>
            <Button className={cn(PRIMARY, 'mt-7 bg-background text-primary hover:bg-background/90')} onClick={onJoin}>{ctaLabel}</Button>
          </Reveal>
        </section>
      </div>

      <Dialog open={dialog === 'choose'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pour quelle entreprise ?</DialogTitle>
            <DialogDescription>Choisissez la fiche exposant pour laquelle demander l'accès.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {fiches.map((f) => (
              <li key={f.exhibitor_id}>
                <Link
                  to={manageLink(f.exhibitor.slug as string)}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border p-3 hover:bg-booth-canvas"
                >
                  {f.exhibitor.logo_url ? (
                    <img src={f.exhibitor.logo_url} alt="" className="h-8 w-8 rounded object-contain" loading="lazy" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded bg-booth-sky text-sm font-semibold">{f.exhibitor.name.charAt(0)}</span>
                  )}
                  <span className="font-medium">{f.exhibitor.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'claim'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revendiquez d'abord la fiche de votre entreprise</DialogTitle>
            <DialogDescription>La demande d'accès se fait ensuite depuis votre espace exposant.</DialogDescription>
          </DialogHeader>
          <Button asChild className={PRIMARY}>
            <Link to="/exposants">Trouver ma fiche</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
