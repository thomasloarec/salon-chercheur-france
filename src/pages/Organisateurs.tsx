import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  FileText,
  Gift,
  Info,
  Megaphone,
  Minus,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import organisateursHero from '@/assets/organisateurs-hero.png.asset.json';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/* ================================================================== */
/* Utils : reduced motion, in-view, révélation au scroll               */
/* (mêmes primitives que la Home et Exposants, dupliquées volontaire-  */
/* ment pour ne pas modifier ces fichiers)                              */
/* ================================================================== */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.14);
  const shown = reduced || inView;
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={`transition-all duration-700 ease-out ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* Cadre mock générique (identique à Exposants et à la Home) */
const Mock = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-[20px] border border-border bg-background shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.22)] p-5 ${className}`}
  >
    {children}
  </div>
);

/* ================================================================== */
/* Compteur animé, adapté de celui de la Home avec un paramètre de     */
/* décimales (l'original de Home n'est pas modifié)                    */
/* ================================================================== */
function CountUp({
  target,
  decimals = 0,
  className = '',
}: {
  target: number;
  decimals?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView || target <= 0) return;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / 1300, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(target * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else setValue(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduced]);

  if (decimals > 0) {
    return <span ref={ref} className={className}>{value.toFixed(decimals).replace('.', ',')}</span>;
  }
  return (
    <span ref={ref} className={className}>
      {value > 0 ? Math.round(value).toLocaleString('fr-FR') : '0'}
    </span>
  );
}

/* ================================================================== */
/* Constantes : textes inchangés, sauf l'étape 2 (voir le document)    */
/* ================================================================== */
const BENEFITS = [
  {
    icon: MousePointerClick,
    title: 'Votre site officiel reste la destination',
    text: "Chaque page Lotexpo renvoie vers vos supports officiels pour l'inscription, les informations pratiques et le contact. Nous n'avons ni billetterie, ni ambition de vous remplacer.",
  },
  {
    icon: ShieldCheck,
    title: 'Vous gardez la main sur votre page',
    text: "Une fois votre salon revendiqué, vous en êtes le gestionnaire. Vos informations font foi et nos imports automatiques ne les écrasent jamais.",
  },
  {
    icon: Target,
    title: "La visibilité ne s'achète pas",
    text: "Aucun classement payant, aucune mise en avant vendue. Nos réponses aux visiteurs dépendent de la pertinence, jamais d'un statut commercial. Personne ne peut acheter une meilleure place que vous.",
  },
  {
    icon: Eye,
    title: "Nous n'indexons que ce qui est déjà public",
    text: "Les informations que nous référençons sont celles que vous publiez déjà sur votre site. Revendiquer votre salon ne nous donne accès à aucune donnée confidentielle.",
  },
  {
    icon: Gift,
    title: 'Gratuit, sans exclusivité',
    text: "Revendiquer et gérer votre salon est gratuit. Vous ne signez rien et vous restez entièrement libre de vos autres canaux.",
  },
  {
    icon: Sparkles,
    title: 'Vos exposants restent vos exposants',
    text: "Les nouveautés qu'ils publient valorisent leur stand et votre événement. Vous pouvez les y encourager, et afficher le résultat sur votre propre site avec le widget.",
  },
];

const IS_LIST = [
  'Un annuaire spécialisé des salons professionnels en France.',
  'Un point d\u2019entrée complémentaire vers votre événement.',
  'Un relais vers votre site officiel, votre billetterie et vos informations pratiques.',
  'Un espace que vous pouvez revendiquer et gérer vous-même, gratuitement.',
  'Un espace où vos exposants peuvent publier leurs Nouveautés.',
  'Un outil d\u2019aide à la préparation de visite pour un public professionnel.',
];

const IS_NOT_LIST = [
  'Une billetterie qui remplace votre système d\u2019inscription.',
  'Un site officiel qui se substitue à votre communication.',
  'Un partenaire officiel, sauf mention explicite.',
  'Un concurrent de votre salon.',
  'Une plateforme qui revendique l\u2019organisation de votre événement.',
  'Un classement où la visibilité se monnaie.',
];

const PROBLEM_CARDS = [
  {
    title: 'Les visiteurs ne cherchent plus seulement une date',
    text: "Un professionnel ne demande plus uniquement quels salons ont lieu en septembre à Lyon. Il cherche où trouver des fournisseurs précis, quelles innovations verra le jour, quels stands valent son temps.",
  },
  {
    title: 'Nous répondons avec ce que nous savons',
    text: "Pour répondre à ces questions, Lotexpo lit la description de votre salon, la liste de vos exposants, leurs spécialités et leurs nouveautés. Un salon dont nous connaissons 40 exposants sur 200 ne peut être proposé que sur ces 40.",
  },
  {
    title: 'Vous êtes la meilleure source sur votre salon',
    text: "Plus vos informations sont complètes, plus nous pouvons proposer votre événement au bon visiteur, sur la bonne recherche, avec une raison concrète de venir. Et un visiteur qui sait pourquoi il vient est un visiteur qui se déplace.",
  },
];

const ROLE_STEPS = [
  {
    icon: ShieldCheck,
    title: 'Revendiquez votre salon',
    text: "Vous déclarez être l'organisateur officiel de l'événement. Notre équipe vérifie, puis la page vous revient. Gratuit, sans engagement.",
  },
  {
    icon: FileText,
    title: 'Complétez vos informations',
    text: "Nom, dates, secteurs, tarif, affluence, photo, description. Vous proposez vos modifications, nous les vérifions, puis elles remplacent les nôtres et ne sont plus jamais écrasées par nos imports. Publiez aussi votre programme : il sera proposé aux visiteurs intéressés.",
  },
  {
    icon: Users,
    title: 'Transmettez votre liste d\u2019exposants',
    text: "Nous en identifions déjà une partie à partir de votre site. Vous seul disposez de la liste complète. Un fichier Excel ou CSV suffit.",
  },
  {
    icon: Megaphone,
    title: 'Activez vos exposants',
    text: "Des emails prêts à envoyer, un lien de suivi, et un widget à installer sur votre site pour afficher les nouveautés de vos exposants.",
  },
];

const FAQ = [
  {
    q: 'Comment revendiquer notre salon ?',
    a: "Recherchez votre salon sur Lotexpo, ouvrez sa page et cliquez sur Revendiquer. Vous confirmez être l'organisateur officiel, notre équipe vérifie la demande, puis la page vous revient. C'est gratuit et cela ne vous engage à rien.",
  },
  {
    q: 'Qui valide les informations que nous modifions ?',
    a: "Vos modifications nous sont transmises pour vérification, puis elles sont publiées. Une fois publiées, elles font foi : nos imports automatiques ne les écrasent jamais.",
  },
  {
    q: 'Est-ce payant pour les organisateurs ?',
    a: "Non. Le référencement, la revendication et la gestion de votre salon sur Lotexpo sont gratuits.",
  },
  {
    q: 'Peut-on acheter une meilleure visibilité sur Lotexpo ?',
    a: "Non. Il n'existe aucun classement payant et aucune mise en avant vendue. Les réponses faites aux visiteurs dépendent de la pertinence, jamais d'un statut commercial.",
  },
  {
    q: 'Que devient la liste d\u2019exposants que nous transmettons ?',
    a: "Elle sert à compléter la liste des exposants affichée sur la page de votre salon, afin que les visiteurs puissent identifier qui sera présent et pourquoi s'y rendre. Ce sont les mêmes informations que celles que vous publiez déjà publiquement sur votre site.",
  },
  {
    q: 'Lotexpo remplace-t-il notre site officiel ?',
    a: "Non. Votre site officiel reste la source de référence pour l'inscription, les informations pratiques, les conditions de participation et les communications officielles. Lotexpo agit comme un point d'entrée complémentaire et renvoie vers vos supports.",
  },
  {
    q: 'Lotexpo est-il affilié aux salons référencés ?',
    a: "Non. Lotexpo est une plateforme indépendante. La présence d'un événement sur Lotexpo ne signifie pas que Lotexpo est affilié à l'organisateur, partenaire officiel ou mandaté par lui, sauf mention explicite.",
  },
  {
    q: 'Lotexpo risque-t-il de détourner les visiteurs de notre site officiel ?',
    a: "Non. Lorsqu'un utilisateur cherche à s'inscrire, à consulter les informations officielles ou à contacter l'organisateur, il est redirigé vers les supports officiels du salon.",
  },
  {
    q: 'Pourquoi encourager nos exposants à publier leurs Nouveautés ?',
    a: "Parce qu'elles donnent aux visiteurs des raisons concrètes de venir. Un salon n'est pas seulement une date et un lieu : ce sont aussi des produits, des innovations, des démonstrations et des rencontres. Les Nouveautés rendent cette valeur visible avant l'ouverture, et vous pouvez les afficher sur votre propre site grâce au widget.",
  },
  {
    q: 'Comment notre salon peut-il être proposé dans l\u2019agenda des visiteurs ?',
    a: "Les visiteurs qui créent leur agenda Lotexpo choisissent leurs sujets et leurs régions. L'IA leur propose un salon à partir de son programme publié et des Nouveautés publiées par ses exposants. Plus votre programme est complet et plus vos exposants publient, plus votre salon a de chances d'être proposé. Un salon sans programme publié ne peut pas être proposé pour ses conférences. Cette visibilité ne s'achète pas.",
  },
  {
    q: 'Que montre Mon marché, et nommez-vous nos exposants ?',
    a: "Mon marché compare votre plateau d'exposants à celui des salons comparables : combien d'entreprises de votre marché exposent ailleurs pour chaque exposant présent chez vous, les salons qui partagent votre vivier, les segments que vous couvrez le mieux et vos angles morts. L'analyse est recalculée chaque nuit et s'exporte en PDF. Aucune entreprise n'est jamais nommée et nous ne livrons aucune liste à démarcher. Tant que vous ne nous avez pas transmis votre liste officielle d'exposants, l'analyse reste partielle.",
  },
  {
    q: 'À quoi sert Le Fil ?',
    a: "À faire parler de votre salon avant l'ouverture. Vous publiez une annonce d'une phrase : un intervenant confirmé, le programme en ligne, l'ouverture de la billetterie. La plus récente s'affiche sous le titre de votre salon, avec un bouton si vous le souhaitez, et les autres restent consultables juste à côté. Vous voyez combien de fois elle a été affichée et combien de clics elle a reçus.",
  },
];

/* ================================================================== */
/* Maquettes                                                           */
/* ================================================================== */
/* Mock 1 - La page du salon, une porte vers les supports officiels    */
const GatewayMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduced = usePrefersReducedMotion();
  const shown = reduced || inView;
  const links = ['Site officiel', 'Inscription et billetterie', 'Informations pratiques'];
  return (
    <Mock>
      <div ref={ref}>
        <p className="heading-display text-lg text-foreground mb-3">Votre salon sur Lotexpo</p>
        <div className="space-y-2.5">
          {links.map((l, i) => (
            <div
              key={l}
              style={{ transitionDelay: `${160 + i * 190}ms` }}
              className={`rounded-xl border border-border px-3 py-2.5 flex items-center justify-between transition-all duration-500 ${
                shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <span className="text-sm font-medium text-foreground">{l}</span>
              <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
            </div>
          ))}
        </div>
        <p className="mt-3.5 border-t border-border pt-3 text-xs text-muted-foreground">
          Chaque bouton mène à vos supports officiels.
        </p>
      </div>
    </Mock>
  );
};

/* Mock 2 - Une session publiée, proposée à un visiteur                */
const ProgramMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduced = usePrefersReducedMotion();
  const shown = reduced || inView;
  return (
    <Mock>
      <div ref={ref}>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
          Votre programme
        </p>
        <div
          style={{ transitionDelay: '160ms' }}
          className={`rounded-xl border border-border p-3 transition-all duration-500 ${
            shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <p className="text-xs text-muted-foreground">Mardi · 10 h 30 · Salle B</p>
          <p className="mt-1 text-sm font-medium leading-snug text-foreground">
            Réduire la consommation d'énergie des lignes de production
          </p>
          <span className="mt-2 inline-flex rounded-full bg-secondary text-primary text-[11px] font-medium px-2 py-0.5">
            Publiée
          </span>
        </div>
        <div
          style={{ transitionDelay: '350ms' }}
          className={`my-2 flex justify-center text-primary transition-opacity duration-500 ${
            shown ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ArrowRight className="h-5 w-5 rotate-90" />
        </div>
        <div
          style={{ transitionDelay: '540ms' }}
          className={`rounded-xl border border-border p-3.5 transition-all duration-500 ${
            shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <span className="inline-flex rounded-full bg-info/10 text-info text-[11px] font-medium px-2 py-0.5">
            Conférence à suivre
          </span>
          <p className="mt-2 text-sm font-medium leading-snug text-foreground">
            Réduire la consommation d'énergie des lignes de production
          </p>
          <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Pourquoi pour vous
            </p>
            <p className="mt-0.5 text-[13px] text-foreground/80">
              Vous cherchez à réduire la facture énergétique de votre usine : retours d'expérience
              chiffrés.
            </p>
          </div>
        </div>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Vu dans l'agenda d'un responsable maintenance
        </p>
      </div>
    </Mock>
  );
};

/* Mock 3 - L'activité du salon, vue comme un signal                   */
const SignalMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduced = usePrefersReducedMotion();
  const shown = reduced || inView;
  const rows = [
    { label: 'Programme publié · 14 sessions', pct: 70 },
    { label: 'Nouveautés d\u2019exposants · 9 publiées', pct: 55 },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex justify-end mb-3">
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            Exemple
          </span>
        </div>
        {rows.map((r, i) => (
          <div key={r.label} className="mb-2.5">
            <p className="text-xs font-medium text-foreground mb-1.5">{r.label}</p>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700"
                style={{
                  width: shown ? `${r.pct}%` : '0%',
                  transitionDelay: `${160 + i * 190}ms`,
                }}
              />
            </div>
          </div>
        ))}
        <div
          style={{ transitionDelay: '540ms' }}
          className={`my-2.5 flex justify-center text-primary transition-opacity duration-500 ${
            shown ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ArrowRight className="h-5 w-5 rotate-90" />
        </div>
        <div
          style={{ transitionDelay: '730ms' }}
          className={`rounded-xl bg-surface-inverse text-inverse p-4 transition-all duration-500 ${
            shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <span className="inline-flex rounded-full border border-inverse/30 px-2 py-0.5 text-[11px] font-medium">
            Salon à ne pas manquer
          </span>
          <p className="mt-2 text-sm">Proposé aux visiteurs dont les sujets correspondent</p>
        </div>
      </div>
    </Mock>
  );
};

/* Mock 4 - Le Fil : une annonce sous le titre du salon                */
const FeedMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduced = usePrefersReducedMotion();
  const shown = reduced || inView;
  return (
    <Mock>
      <div ref={ref}>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
          Page de votre salon
        </p>
        <p className="heading-display text-xl text-foreground">Votre salon</p>
        <p className="text-xs text-muted-foreground mb-3">Lyon · 12 au 14 mars 2027</p>
        <div
          className={`rounded-lg border-l-[3px] border-primary bg-secondary/40 px-3 py-2 transition-all duration-500 ${
            shown ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'
          }`}
        >
          <span className="text-[11px] font-medium text-primary">Programme</span>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            Le programme des conférences est en ligne.
          </p>
          <span className="mt-1.5 inline-block rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground">
            Voir le programme
          </span>
        </div>
        <div className="mt-3.5 border-t border-border pt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            <CountUp target={1240} /> affichages
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            <CountUp target={86} /> clics
          </span>
        </div>
      </div>
    </Mock>
  );
};

/* Mock 5 - Mon marché, en exemple anonyme                             */
const MarketMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduced = usePrefersReducedMotion();
  const shown = reduced || inView;
  const comparables = [
    { name: 'Salon comparable A', n: 68, pct: 100 },
    { name: 'Salon comparable B', n: 41, pct: 60 },
    { name: 'Salon comparable C', n: 23, pct: 34 },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex justify-end mb-3">
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            Exemple anonyme
          </span>
        </div>
        <div className="rounded-lg bg-surface-inverse text-inverse p-5">
          <CountUp target={2.4} decimals={1} className="heading-display text-5xl" />
          <p className="mt-2 text-sm text-inverse-muted max-w-[34ch]">
            entreprises de votre marché exposent ailleurs pour chaque exposant présent chez vous.
          </p>
        </div>
        <p className="mt-4 mb-2.5 text-sm font-medium text-foreground">
          Les salons qui partagent votre vivier
        </p>
        <div className="space-y-2.5">
          {comparables.map((c, i) => (
            <div key={c.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-foreground">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{c.n}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700"
                  style={{
                    width: shown ? `${c.pct}%` : '0%',
                    transitionDelay: `${160 + i * 190}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Mock>
  );
};

/* Mock 6 - Le widget sur le site officiel du salon                    */
const WidgetMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduced = usePrefersReducedMotion();
  const shown = reduced || inView;
  const cards = [
    { title: 'Lancement de notre gamme éco-responsable', exhibitor: 'NovaTech' },
    { title: 'Démonstration en direct sur le stand', exhibitor: 'AtelierPro' },
    { title: 'Offre spéciale réservée aux visiteurs', exhibitor: 'GreenLine' },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 mb-4">
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <span className="ml-2 text-xs font-medium text-muted-foreground">
            Site officiel du salon
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-foreground" />
          <h3 className="text-sm font-bold text-foreground">Nouveautés des exposants</h3>
        </div>
        <div className="space-y-3">
          {cards.map((c, i) => (
            <div
              key={c.title}
              style={{ transitionDelay: `${160 + i * 190}ms` }}
              className={`flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all duration-500 ${
                shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="h-12 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">{c.exhibitor}</p>
              </div>
              <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                Découvrir
              </span>
            </div>
          ))}
        </div>
      </div>
    </Mock>
  );
};

/* ================================================================== */
/* Blocs solution alternés (modèle Exposants)                          */
/* ================================================================== */
interface SolutionBlock {
  actor: string;
  title: string;
  body: React.ReactNode;
  ecoNote: string;
  cta?: { label: string; to: string };
  visual: React.ReactNode;
}

const SolutionRow = ({
  block,
  reversed,
  muted,
}: {
  block: SolutionBlock;
  reversed: boolean;
  muted?: boolean;
}) => (
  <Reveal className={cn('w-full', muted && 'bg-muted/40')}>
    <div className="max-w-[1180px] mx-auto px-7 py-14 grid grid-cols-1 lg:grid-cols-2 gap-y-[38px] lg:gap-y-0 lg:gap-x-[74px] items-center">
      <div className={reversed ? 'lg:order-last' : ''}>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-primary font-bold text-[0.78rem] uppercase tracking-[0.06em] px-[13px] py-[5px] mb-4">
          {block.actor}
        </span>
        <h3 className="heading-display font-bold text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.12] text-foreground max-w-[16ch]">
          {block.title}
        </h3>
        <p className="mt-[18px] text-[1.08rem] leading-[1.65] text-foreground/70 max-w-[46ch]">
          {block.body}
        </p>
        <div className="mt-5 flex gap-[11px] items-start bg-secondary/25 border-l-[3px] border-primary rounded-r-[10px] px-4 py-[13px] max-w-[46ch]">
          <Info className="h-[18px] w-[18px] text-primary shrink-0 mt-0.5" />
          <p className="text-[0.96rem] leading-relaxed text-foreground/75">{block.ecoNote}</p>
        </div>
        {block.cta && (
          <Link
            to={block.cta.to}
            className="group mt-6 inline-flex items-center gap-2 font-bold text-primary transition-colors hover:text-primary"
          >
            {block.cta.label}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      <div className={reversed ? 'lg:order-first' : ''}>{block.visual}</div>
    </div>
  </Reveal>
);

const SOLUTION_BLOCKS: SolutionBlock[] = [
  {
    actor: 'Votre site officiel',
    title: "Une porte d'entrée supplémentaire vers votre salon officiel",
    body: (
      <>
        Votre salon est découvert par des professionnels qui cherchent par secteur, ville, région ou
        date.{' '}
        <strong className="font-semibold text-primary">
          Quand ils veulent s'inscrire, Lotexpo les renvoie vers vos supports officiels.
        </strong>{' '}
        Cette visibilité est gratuite et s'ajoute à votre communication.
      </>
    ),
    ecoNote:
      'Votre site officiel reste la source de référence. Lotexpo aide simplement davantage de visiteurs qualifiés à y arriver.',
    cta: { label: 'Revendiquer mon salon', to: '/trouver-un-salon' },
    visual: <GatewayMock />,
  },
  {
    actor: 'Programme',
    title: "Publiez votre programme, l'assistant le propose aux bons visiteurs",
    body: (
      <>
        Créez vos sessions, publiez-les quand vous êtes prêt. L'IA de Lotexpo lit chaque session et
        la propose dans l'agenda des visiteurs qui ont choisi ces sujets.{' '}
        <strong className="font-semibold text-primary">
          Un programme publié, c'est une chance de plus d'être proposé.
        </strong>
      </>
    ),
    ecoNote: 'Un salon sans programme publié ne peut pas être proposé pour ses conférences.',
    visual: <ProgramMock />,
  },
  {
    actor: 'Vos exposants',
    title: 'Chaque Nouveauté de vos exposants rapproche votre salon des visiteurs',
    body: (
      <>
        Un salon est proposé aux visiteurs à partir de son programme et des Nouveautés publiées par
        ses exposants : lancements, démonstrations, innovations.{' '}
        <strong className="font-semibold text-primary">
          Plus vos exposants publient, plus votre salon a de chances d'être proposé.
        </strong>{' '}
        Dans votre espace, « Activer mes exposants » vous donne des emails prêts à envoyer pour les
        y inviter.
      </>
    ),
    ecoNote:
      "La visibilité ne s'achète pas : elle se gagne par l'activité de votre salon et de ses exposants.",
    cta: { label: 'Revendiquer mon salon', to: '/trouver-un-salon' },
    visual: <SignalMock />,
  },
  {
    actor: 'Le Fil',
    title: "Faites parler de votre salon avant l'ouverture",
    body: (
      <>
        Une phrase suffit : un intervenant confirmé, le programme en ligne, l'ouverture de la
        billetterie.{' '}
        <strong className="font-semibold text-primary">
          Votre annonce s'affiche sous le titre de votre salon
        </strong>
        , avec un bouton si vous le souhaitez. Les précédentes restent consultables juste à côté.
      </>
    ),
    ecoNote:
      'Vous voyez combien de fois chaque annonce a été affichée et combien de clics elle a reçus.',
    visual: <FeedMock />,
  },
  {
    actor: 'Mon marché',
    title: 'Situez votre salon dans son marché',
    body: (
      <>
        Pour chaque exposant présent chez vous, combien d'entreprises de votre marché exposent
        ailleurs ? Mon marché vous le dit, puis montre{' '}
        <strong className="font-semibold text-primary">
          les salons qui partagent votre vivier, les segments que vous couvrez le mieux et vos
          angles morts.
        </strong>{' '}
        Recalcul chaque nuit, export en PDF.
      </>
    ),
    ecoNote:
      "Aucune entreprise n'est jamais nommée. Votre liste officielle d'exposants débloque l'analyse complète.",
    visual: <MarketMock />,
  },
  {
    actor: 'Widget',
    title: 'Affichez les temps forts de vos exposants sur votre site officiel',
    body: (
      <>
        Le widget Lotexpo intègre sur le site de votre salon les Nouveautés publiées par vos
        exposants.{' '}
        <strong className="font-semibold text-primary">
          Vous enrichissez votre site sans tout produire vous-même.
        </strong>{' '}
        Il ne remplace pas vos pages officielles : il ajoute un bloc de contenu vivant.
      </>
    ),
    ecoNote:
      "Les exposants gagnent en visibilité, les visiteurs préparent mieux leur venue, et votre salon gagne un contenu plus attractif avant l'ouverture.",
    cta: { label: 'Revendiquer mon salon', to: '/trouver-un-salon' },
    visual: <WidgetMock />,
  },
];

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
const Organisateurs = () => {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <Helmet>
        <title>Organisateurs de salons professionnels | Lotexpo</title>
        <meta
          name="description"
          content="Revendiquez la page de votre salon sur Lotexpo, gratuitement. Vous gardez la main sur vos informations, votre site officiel reste la destination, et la visibilité ne s'achète pas."
        />
        <link rel="canonical" href="https://lotexpo.com/organisateurs" />
        <meta property="og:title" content="Organisateurs de salons professionnels | Lotexpo" />
        <meta
          property="og:description"
          content="Revendiquez la page de votre salon sur Lotexpo, gratuitement. Vous gardez la main sur vos informations, votre site officiel reste la destination, et la visibilité ne s'achète pas."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://lotexpo.com/organisateurs" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Salons', item: 'https://lotexpo.com' },
              { '@type': 'ListItem', position: 2, name: 'Organisateurs de salons', item: 'https://lotexpo.com/organisateurs' },
            ],
          })}
        </script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden bg-background">
          {/* Image d'en-tête, fondue vers la gauche (modèle Exposants) */}
          <div aria-hidden className="absolute inset-y-0 right-0 z-0 w-full lg:w-[72%]">
            <img
              src={organisateursHero.url}
              alt=""
              className="h-full w-full object-cover object-center"
              style={{
                maskImage:
                  'linear-gradient(90deg, transparent 0%, transparent 14%, black 46%)',
                WebkitMaskImage:
                  'linear-gradient(90deg, transparent 0%, transparent 14%, black 46%)',
              }}
            />
            {/* Voile sur mobile : l'image passe derrière le texte */}
            <div className="absolute inset-0 bg-background/75 lg:hidden" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:py-24">
            <Reveal className="text-left max-w-[560px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-background border border-border shadow-sm pl-2 pr-4 py-1.5 text-sm font-semibold text-primary mb-5">
                <span className="rounded-full bg-primary text-primary-foreground text-[0.7rem] font-bold uppercase tracking-wide px-2 py-0.5">
                  Gratuit
                </span>
                Espace organisateurs
              </span>

              <h1 className="heading-display text-[clamp(1.9rem,3.6vw,3.3rem)] text-foreground max-w-[17ch] text-balance">
                Votre salon vous appartient.
                <span className="block text-primary">Sur Lotexpo aussi.</span>
              </h1>

              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-[52ch]">
                Chaque jour, des professionnels viennent sur Lotexpo pour savoir quel salon mérite
                leur déplacement. Vous êtes les seuls à détenir la vérité sur votre événement.{' '}
                <b className="text-foreground font-semibold">
                  Revendiquez sa page : votre site officiel reste la destination, Lotexpo intervient
                  au moment où le visiteur décide.
                </b>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/trouver-un-salon">
                  <Button size="lg" className="h-12 rounded-xl px-6 text-base gap-2 shadow-lg">
                    <ShieldCheck className="h-5 w-5" />
                    Revendiquer mon salon
                  </Button>
                </Link>
                <a href="#etapes">
                  <Button variant="outline" className="h-12 rounded-xl px-6 text-base">
                    Comment ça marche
                  </Button>
                </a>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                Recherchez votre salon, ouvrez sa page, puis cliquez sur Revendiquer.
              </p>

              <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                {['Gratuit, sans engagement', 'Vous gardez la main', 'Votre site officiel reste la destination'].map(
                  (t, i) => (
                    <React.Fragment key={t}>
                      {i > 0 && <span aria-hidden>·</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-primary" />
                        {t}
                      </span>
                    </React.Fragment>
                  ),
                )}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================= BANDEAU CHIFFRES ============================= */}
        <section className="border-y border-border bg-secondary/40">
          <div className="max-w-5xl mx-auto px-6 py-11 flex flex-col items-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-6 text-center">
              Nos engagements en trois chiffres
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 w-full max-w-3xl">
              {[
                {
                  big: 'Gratuit',
                  lbl: 'Revendiquer et gérer votre salon ne coûte rien et ne vous engage à rien.',
                },
                {
                  big: '100 %',
                  lbl: 'de vos informations font foi : nos imports automatiques ne les écrasent jamais.',
                },
                {
                  big: '0 €',
                  lbl: 'de visibilité achetable : personne ne peut acheter une meilleure place que vous.',
                },
              ].map((c, i) => (
                <Reveal
                  key={c.big}
                  delay={i * 80}
                  className={`text-center sm:relative ${
                    i < 2
                      ? 'sm:after:content-[""] sm:after:absolute sm:after:-right-5 sm:after:top-[12%] sm:after:h-[76%] sm:after:w-px sm:after:bg-border'
                      : ''
                  }`}
                >
                  <div className="heading-display text-[clamp(2rem,3.4vw,2.9rem)] text-primary leading-none">
                    {c.big}
                  </div>
                  <div className="mt-2.5 text-muted-foreground font-medium leading-snug">{c.lbl}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= LE CONSTAT (section inverse) ============================= */}
        <section className="relative overflow-hidden bg-surface-inverse text-inverse py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/home-texture-plexus.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.28,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-6">
            <Reveal className="max-w-[760px] mx-auto text-center mb-[60px]">
              <div className="w-[46px] h-[3px] bg-inverse-primary rounded-full mx-auto mb-5" />
              <p className="text-inverse-primary font-bold uppercase tracking-[0.15em] text-xs mb-3">
                Le constat
              </p>
              <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">
                Pourquoi des informations complètes vous amènent des visiteurs plus qualifiés
              </h2>
            </Reveal>

            <Reveal className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
                {PROBLEM_CARDS.flatMap((c, i, arr) => {
                  const card = (
                    <Reveal
                      key={c.title}
                      delay={i * 80}
                      className="flex-1 rounded-2xl border border-inverse/15 bg-inverse/5 p-6 text-left"
                    >
                      <h3 className="heading-display text-xl mb-2">{c.title}</h3>
                      <p className="text-sm text-inverse-muted leading-relaxed">{c.text}</p>
                    </Reveal>
                  );
                  if (i < arr.length - 1) {
                    return [
                      card,
                      <div
                        key={`${c.title}-arrow`}
                        className="flex items-center justify-center text-inverse/40 px-2 rotate-90 md:rotate-0"
                      >
                        <ArrowRight className="h-6 w-6" />
                      </div>,
                    ];
                  }
                  return [card];
                })}
              </div>
            </Reveal>

            <Reveal className="text-center mt-14">
              <div className="heading-display text-[clamp(1.8rem,4vw,3rem)] max-w-[22ch] mx-auto">
                Nous ne décidons pas quels salons méritent d'être vus. Nous répondons avec ce que
                nous savons.{' '}
                <em className="not-italic text-inverse-primary">
                  Vous êtes les mieux placés pour nous le dire.
                </em>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================= LA SOLUTION ============================= */}
        <section className="bg-background pt-24 pb-10">
          <Reveal className="max-w-[760px] mx-auto px-6 text-center mb-[60px]">
            <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
            <p className="text-primary font-bold uppercase tracking-[0.15em] text-xs mb-3">
              Ce que Lotexpo fait pour votre salon
            </p>
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)] text-foreground">
              Transformer l'attention en intention de visite
            </h2>
            <p className="mt-4 text-lg text-foreground/70">
              Lotexpo structure l'attention avant le salon, pour aider les visiteurs à décider plus
              facilement si votre événement mérite leur temps.{' '}
              <b className="font-semibold text-primary">
                Un visiteur qui sait pourquoi il vient est un visiteur qui se déplace.
              </b>
            </p>
          </Reveal>

          <div className="flex flex-col">
            {SOLUTION_BLOCKS.map((b, i) => (
              <SolutionRow key={b.title} block={b} reversed={i % 2 === 1} muted={i % 2 === 0} />
            ))}
          </div>
        </section>

        {/* ============================= ÉTAPES ============================= */}
        <section id="etapes" className="bg-background border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal className="max-w-[640px] mx-auto text-center mb-14">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                Ce que vous pouvez faire, dès maintenant
              </h2>
              <p className="mt-4 text-lg text-foreground/70">
                Jusqu'ici, les organisateurs étaient les seuls acteurs de l'écosystème à ne rien
                pouvoir faire sur Lotexpo. Ce n'est plus le cas.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ROLE_STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-border bg-background p-7 transition-colors hover:border-primary/40">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
                      Étape {i + 1}
                    </p>
                    <h3 className="heading-display text-xl text-foreground mb-2.5">{s.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-12 text-center">
              <Link to="/trouver-un-salon">
                <Button size="lg" className="h-12 rounded-xl px-6 text-base gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Revendiquer mon salon
                </Button>
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ============================= LOTEXPO EST / N'EST PAS ============================= */}
        <section className="bg-background">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <Reveal className="max-w-[760px] mx-auto text-center mb-12">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                Une plateforme indépendante, pensée pour renforcer votre visibilité
              </h2>
              <p className="mt-4 text-lg text-foreground/70">
                Lotexpo clarifie son rôle pour que les organisateurs gardent la maîtrise de leur
                communication officielle.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                La présence d'un événement sur Lotexpo ne constitue pas une affiliation officielle
                avec l'organisateur, sauf mention explicite. Si vous représentez un salon,
                revendiquez sa page pour en devenir le gestionnaire et corriger vous-même les
                informations affichées.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Reveal className="h-full">
                <div className="h-full bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                  <h3 className="heading-display text-xl text-foreground mb-5 flex items-center gap-2">
                    <Check className="w-6 h-6 text-primary" />
                    Lotexpo est
                  </h3>
                  <ul className="space-y-3">
                    {IS_LIST.map((item) => (
                      <li key={item} className="flex items-start gap-3 font-medium text-foreground/80">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal className="h-full" delay={80}>
                <div className="h-full bg-muted/40 border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                  <h3 className="heading-display text-xl text-foreground mb-5 flex items-center gap-2">
                    <Minus className="w-6 h-6 text-muted-foreground" />
                    Lotexpo n'est pas
                  </h3>
                  <ul className="space-y-3">
                    {IS_NOT_LIST.map((item) => (
                      <li key={item} className="flex items-start gap-3 font-medium text-foreground/80">
                        <Minus className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>

            <Reveal className="mt-8">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 text-center">
                <p className="text-base text-foreground font-medium">
                  En résumé : Lotexpo ne capte pas l'attention à votre place. Il aide à canaliser
                  une attention déjà dispersée vers votre événement officiel.
                </p>
                <p className="mt-2 text-sm md:text-base text-foreground font-medium">
                  Notre objectif est simple : rendre les salons professionnels plus faciles à
                  découvrir, sans prendre la place des organisateurs.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================= NOS ENGAGEMENTS ============================= */}
        <section className="bg-muted/40 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <Reveal className="text-center mb-12">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                Nos engagements envers vous
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENEFITS.map((benefit, i) => {
                const Icon = benefit.icon;
                return (
                  <Reveal key={benefit.title} delay={i * 80}>
                    <div className="h-full bg-card border border-border rounded-2xl p-6 shadow-sm">
                      <div className="bg-secondary text-primary rounded-xl p-3 w-fit mb-4">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="heading-display text-lg text-foreground mb-2">
                        {benefit.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================= FAQ ============================= */}
        <section id="faq" className="bg-background">
          <div className="max-w-3xl mx-auto px-6 py-20">
            <Reveal className="text-center mb-12">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                Questions fréquentes
              </h2>
            </Reveal>

            <Reveal>
              <Accordion type="single" collapsible className="space-y-4">
                {FAQ.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`} className="rounded-xl border px-6">
                    <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* ============================= CTA FINAL ============================= */}
        <section
          className="relative overflow-hidden text-primary-foreground text-center py-24"
          style={{ background: 'linear-gradient(160deg, hsl(var(--primary)), hsl(218 95% 14%))' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/home-texture-final.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.3,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 70% at 50% 50%, hsl(var(--primary) / 0.55), hsl(218 95% 14% / 0.9))',
            }}
          />
          <Reveal className="relative z-10 max-w-3xl mx-auto px-6">
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">
              Votre salon est déjà sur Lotexpo. Prenez-en la main.
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-[52ch] mx-auto">
              La revendication est gratuite et ne vous engage à rien.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link to="/trouver-un-salon">
                <Button className="h-12 rounded-xl bg-background px-6 text-base text-primary hover:bg-background/90 gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Revendiquer mon salon
                </Button>
              </Link>
              <a href="#faq">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Voir les questions fréquentes
                </Button>
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Organisateurs;
