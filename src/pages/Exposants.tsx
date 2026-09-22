import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileUp,
  Info,
  Lightbulb,
  MapPin,
  Megaphone,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import exposantsHeroAsset from '@/assets/exposants-hero.png.asset.json';
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
/* (mêmes primitives que la Home, dupliquées volontairement pour ne    */
/*  pas modifier Home.tsx)                                             */
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

/* Cadre mock générique (identique à la Home) */
const Mock = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-[20px] border border-border bg-background shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.22)] p-5 ${className}`}
  >
    {children}
  </div>
);

/* ================================================================== */
/* Mock 1 — L'assistant IA : votre matière devient des angles          */
/* ================================================================== */
const AiMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const angles = [
    {
      title: 'La cobotique de soudure accessible aux ateliers de 10 personnes',
      why: 'Démonstration en continu sur le stand, pièce soudée repartie en main.',
    },
    {
      title: '30 % de temps de réglage en moins sur vos séries courtes',
      why: 'Le chiffre mesuré chez trois clients pilotes, expliqué en 2 minutes.',
    },
    {
      title: 'Ce que nous montrons pour la première fois en France',
      why: 'Avant-première européenne, présentée uniquement pendant le salon.',
    },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div
          className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 mb-3"
          style={{ borderColor: 'hsl(var(--primary) / 0.5)', backgroundColor: 'hsl(var(--primary) / 0.06)' }}
        >
          <FileUp className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-primary font-medium truncate">
            plaquette-produit-2026.pdf
          </span>
          <span className="ml-auto text-[0.7rem] font-bold text-primary shrink-0">lu par l'IA</span>
        </div>

        <div className="space-y-1.5 mb-4">
          {['Lecture de votre matière', 'Recherche des meilleurs angles'].map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-xs text-foreground">
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span
                className="transition-opacity duration-500"
                style={{ transitionDelay: `${i * 220}ms`, opacity: inView ? 1 : 0.35 }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2.5">
          3 angles proposés
        </p>

        <div className="space-y-2.5">
          {angles.map((a, i) => (
            <div
              key={a.title}
              style={{ transitionDelay: `${240 + i * 190}ms` }}
              className={`rounded-[14px] border border-border bg-background px-4 py-3 transition-all duration-500 ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-sm font-semibold leading-snug text-foreground">{a.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{a.why}</p>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-primary">
                Utiliser cet angle
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
          L'assistant ne remplace pas vos mots, il révèle pourquoi votre nouveauté mérite une visite.
        </div>
      </div>
    </Mock>
  );
};

/* ================================================================== */
/* Mock 2 — La nouveauté publiée, vue par un visiteur                  */
/* ================================================================== */
const NoveltyMock = () => (
  <Mock className="max-w-[420px] mx-auto">
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="rounded-md bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
        Innovation
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-foreground bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
        <Clock className="h-3 w-3" />
        J-12
      </span>
    </div>

    <div
      className="h-[132px] rounded-xl mb-4 flex items-center justify-center"
      style={{
        background:
          'linear-gradient(135deg, hsl(var(--primary) / 0.22), hsl(var(--secondary)))',
      }}
    >
      <Megaphone className="h-10 w-10 text-primary opacity-50" />
    </div>

    <p className="heading-display text-lg leading-snug text-foreground mb-2.5">
      La cobotique de soudure accessible aux ateliers de 10 personnes
    </p>

    <div className="flex items-center gap-2.5 mb-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
        A
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight text-primary truncate">Atelier Meca</div>
        <div className="text-xs text-muted-foreground">Stand C12 · Global Industrie</div>
      </div>
    </div>

    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
      Pourquoi c'est intéressant
    </p>
    <ul className="space-y-1.5 mb-4">
      {[
        'Démonstration en continu, pièce soudée repartie en main.',
        '30 % de temps de réglage en moins sur les séries courtes.',
      ].map((r) => (
        <li key={r} className="flex gap-2 text-xs leading-relaxed text-foreground/80">
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
          {r}
        </li>
      ))}
    </ul>

    <div className="flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold text-info">
      <Eye className="h-4 w-4" />
      Repérée par 34 visiteurs · 8 prévoient de passer
    </div>
  </Mock>
);

/* ================================================================== */
/* Mock 3 — Les contacts générés avant l'ouverture                     */
/* ================================================================== */
const LeadsMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const leads = [
    { who: 'Responsable production · PME agroalimentaire', act: 'Demande de rendez-vous', cls: 'bg-primary/15 text-primary', icon: CalendarCheck },
    { who: 'Directeur technique · groupe industriel', act: 'Brochure téléchargée', cls: 'bg-info/10 text-info', icon: Download },
    { who: 'Acheteur · sous-traitance mécanique', act: 'Stand ajouté à son parcours', cls: 'bg-secondary text-secondary-foreground', icon: MapPin },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
          <span className="font-bold text-primary">Vos contacts · avant l'ouverture</span>
          <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
            J-12
          </span>
        </div>

        <div className="my-3.5 rounded-xl bg-secondary/40 px-3.5 py-3 text-sm text-primary">
          <b>3 professionnels</b> se sont manifestés sur votre nouveauté. Le salon n'a pas encore
          ouvert.
        </div>

        {leads.map((l, i) => (
          <div
            key={l.who}
            style={{ transitionDelay: `${160 + i * 190}ms` }}
            className={`mb-2.5 rounded-[13px] border border-border p-[15px] transition-all duration-500 ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-sm font-semibold text-foreground">{l.who}</span>
            </div>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-bold ${l.cls}`}
            >
              <l.icon className="h-3 w-3" />
              {l.act}
            </span>
          </div>
        ))}

        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Vous arrivez sur le salon avec des rendez-vous, pas avec une liste vide.
        </p>
      </div>
    </Mock>
  );
};

/* ================================================================== */
/* Blocs solution alternés (modèle Home)                               */
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
    actor: "L'IA rédige avec vous",
    title: 'Vous avez la matière. L’IA en fait une nouveauté qui donne envie.',
    body: (
      <>
        Un PDF, une plaquette, un post déjà écrit, ou trois phrases en vrac : l'assistant lit votre
        matière, en extrait même les visuels, et vous propose{' '}
        <strong className="font-semibold text-primary">plusieurs angles de présentation</strong>. Vous
        choisissez celui qui vous ressemble, vous ajustez, c'est publié.
      </>
    ),
    ecoNote:
      "Présenter une innovation en quelques lignes est un exercice difficile. C'est exactement ce que l'assistant a été entraîné à faire.",
    cta: { label: 'Publier ma nouveauté', to: '/publier-nouveaute' },
    visual: <AiMock />,
  },
  {
    actor: 'Avant le salon',
    title: 'Visible au moment exact où les visiteurs préparent leur venue',
    body: (
      <>
        Votre nouveauté apparaît sur la page du salon, dans les nouveautés du site et dans les
        réponses de la recherche IA.{' '}
        <strong className="font-semibold text-primary">
          Les visiteurs la repèrent pendant qu'ils construisent leur parcours
        </strong>
        , des semaines avant d'entrer dans le hall.
      </>
    ),
    ecoNote:
      "Le jour J, on ne vous découvre plus par hasard en passant dans l'allée : on vient vous voir exprès.",
    cta: { label: 'Voir les nouveautés déjà publiées', to: '/nouveautes' },
    visual: <NoveltyMock />,
  },
  {
    actor: 'Le plus important',
    title: 'Des contacts qualifiés avant même l’ouverture des portes',
    body: (
      <>
        Chaque visiteur peut demander un rendez-vous, télécharger votre brochure ou ajouter votre
        stand à son parcours.{' '}
        <strong className="font-semibold text-primary">
          Chacune de ces actions vous remonte comme un contact
        </strong>
        , exploitable avant le premier jour du salon.
      </>
    ),
    ecoNote:
      'Votre stand est déjà payé. Ces contacts, eux, ne vous coûtent rien de plus : ils sont le rendement de votre présence.',
    cta: { label: 'Publier ma nouveauté', to: '/publier-nouveaute' },
    visual: <LeadsMock />,
  },
];

/* ================================================================== */
/* Étapes                                                              */
/* ================================================================== */
const STEPS = [
  {
    icon: Search,
    n: 'Étape 1',
    title: 'Retrouvez votre salon',
    text: "Cherchez l'événement auquel vous participez et ouvrez la publication depuis sa page.",
  },
  {
    icon: Sparkles,
    n: 'Étape 2',
    title: "Laissez l'IA écrire le premier jet",
    text: 'Importez un PDF ou collez votre texte. L’assistant propose les angles, vous gardez la main sur chaque mot.',
  },
  {
    icon: Users,
    n: 'Étape 3',
    title: 'Récupérez vos contacts',
    text: 'Rendez-vous demandés, brochures téléchargées, stands ajoutés aux parcours : tout vous remonte avant le salon.',
  },
];

const FAQ = [
  {
    q: 'Est-ce vraiment gratuit ?',
    a: "Oui. Publier votre nouveauté sur Lotexpo est gratuit, sans carte bancaire et sans engagement. Vous êtes exposant sur un salon référencé, vous publiez, c'est tout.",
  },
  {
    q: 'Que puis-je publier comme nouveauté ?',
    a: "Un nouveau produit, une démonstration, une innovation, un service, une offre spéciale, un cas client, une conférence ou une animation : tout ce qui donne à un visiteur une raison concrète de passer sur votre stand.",
  },
  {
    q: "Comment l'IA fonctionne-t-elle exactement ?",
    a: "Vous lui donnez votre matière : un PDF de plaquette ou de présentation, un post que vous avez déjà rédigé, ou simplement quelques phrases. Elle en extrait le texte et les visuels exploitables, puis vous propose plusieurs angles de présentation. Vous choisissez, vous modifiez librement, rien n'est publié sans votre validation.",
  },
  {
    q: "Comment récupère-t-on les contacts générés ?",
    a: "Chaque demande de rendez-vous, téléchargement de brochure ou ajout à un parcours de visite est enregistré et vous est transmis. Vous pouvez recontacter ces professionnels avant le salon, pendant qu'ils préparent encore leur venue.",
  },
  {
    q: "Faut-il un grand stand ou une grosse notoriété ?",
    a: "Non, et c'est précisément l'intérêt. Une nouveauté bien présentée permet d'être repéré indépendamment de votre emplacement dans le hall ou de la taille de votre stand.",
  },
  {
    q: 'Combien de temps avant sa mise en ligne ?',
    a: "Votre nouveauté est relue par l'équipe Lotexpo sous 24 heures avant publication. Vous êtes prévenu dès qu'elle est en ligne.",
  },
];

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
export default function Exposants() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Publier une nouveauté sur vos salons, gratuitement | Lotexpo</title>
        <meta
          name="description"
          content="Annoncez gratuitement ce que vous présentez sur votre stand. L'IA de Lotexpo rédige votre nouveauté à partir de vos documents, et vous génère des rendez-vous avant l'ouverture du salon."
        />
        <link rel="canonical" href="https://lotexpo.com/exposants" />
        <meta
          property="og:title"
          content="Publier une nouveauté sur vos salons, gratuitement | Lotexpo"
        />
        <meta property="og:url" content="https://lotexpo.com/exposants" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Salons', item: 'https://lotexpo.com' },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Exposants',
                item: 'https://lotexpo.com/exposants',
              },
            ],
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          })}
        </script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden">
          {/* Image d'en-tête, fondue vers la gauche (modèle Home) */}
          <div aria-hidden className="absolute inset-y-0 right-0 z-0 w-full lg:w-[72%]">
            <img
              src={exposantsHeroAsset.url}
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

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:min-h-[calc(100vh-64px)] lg:py-0 flex flex-col justify-center">
            <Reveal className="text-left max-w-[560px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-background border border-border shadow-sm pl-2 pr-4 py-1.5 text-sm font-semibold text-primary mb-5">
                <span className="rounded-full bg-primary text-primary-foreground text-[0.7rem] font-bold uppercase tracking-wide px-2 py-0.5">
                  Gratuit
                </span>
                Publier une nouveauté ne coûte rien
              </span>

              <h1 className="heading-display text-[clamp(1.9rem,3.6vw,3.3rem)] text-foreground max-w-[17ch] text-balance">
                Attirez les bons visiteurs
                <span className="block text-primary">avant l'ouverture des portes.</span>
              </h1>

              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-[52ch]">
                Annoncez ce que vous présentez sur votre stand. Les visiteurs qui préparent déjà leur
                venue vous repèrent,{' '}
                <b className="text-foreground font-semibold">
                  et vous arrivez au salon avec des rendez-vous.
                </b>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-6 text-base gap-2 shadow-lg"
                  onClick={() => navigate('/publier-nouveaute')}
                >
                  <Megaphone className="h-5 w-5" />
                  Publier ma première nouveauté
                </Button>
                <span className="text-sm text-muted-foreground">ou</span>
                <Link to="/nouveautes">
                  <Button variant="outline" className="h-12 rounded-xl px-6 text-base">
                    Voir des exemples
                  </Button>
                </Link>
              </div>

              <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                {['100 % gratuit', 'Sans carte bancaire', "Rédigée avec l'IA en quelques minutes"].map(
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
              Ce que change une nouveauté publiée
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 w-full max-w-3xl">
              {[
                { big: '0 €', lbl: 'pour publier votre nouveauté, sans carte bancaire' },
                { big: '~5 min', lbl: "de votre temps, l’IA écrit le premier jet" },
                { big: 'Avant J-1', lbl: 'les premiers contacts arrivent avant le salon' },
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
                Vous avez payé le stand. Pas l'attention.
              </h2>
              <p className="mt-4 text-lg text-inverse-muted max-w-[62ch] mx-auto">
                Un salon coûte cher, se prépare des mois à l'avance, et se joue pourtant sur trois
                jours de passage dans une allée.
              </p>
            </Reveal>

            <Reveal className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
                {[
                  {
                    title: 'Votre nom dans une liste',
                    text: "Vous apparaissez parmi des centaines d'exposants. Rien n'indique au visiteur ce que vous montrez, ni pourquoi cela le concerne.",
                  },
                  {
                    title: 'Un parcours déjà décidé',
                    text: 'Les visiteurs préparent leur visite en amont. Quand ils arrivent, leur liste de stands est faite, et vous n’y êtes pas.',
                  },
                  {
                    title: 'Un temps fort découvert trop tard',
                    text: 'Démonstration, lancement, offre : si on l’apprend sur place, la majorité des visiteurs ne passera jamais.',
                  },
                ].flatMap((c, i, arr) => {
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
              <div className="heading-display text-[clamp(1.8rem,4vw,3rem)]">
                Tout se joue <em className="not-italic italic text-inverse-primary">avant</em> le
                salon.
              </div>
              <p className="mt-6 text-lg text-inverse-muted max-w-[56ch] mx-auto">
                C'est là que se décide qui vient vous voir. Et c'est exactement là que Lotexpo vous
                rend visible, gratuitement.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================= LA SOLUTION ============================= */}
        <section className="bg-background pt-24 pb-10">
          <Reveal className="max-w-[760px] mx-auto px-6 text-center mb-[60px]">
            <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
            <p className="text-primary font-bold uppercase tracking-[0.15em] text-xs mb-3">
              La nouveauté
            </p>
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)] text-foreground">
              Annoncez. Soyez repéré. Récupérez vos contacts.
            </h2>
            <p className="mt-4 text-lg text-foreground/70">
              Une nouveauté, ce n'est pas un post de plus. C'est une page dédiée à ce que vous montrez
              sur votre stand,{' '}
              <b className="font-semibold text-primary">
                lue par les visiteurs qui préparent ce salon précis.
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
        <section className="bg-background border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal className="max-w-[640px] mx-auto text-center mb-14">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                Trois étapes, quelques minutes
              </h2>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-border bg-background p-7 transition-colors hover:border-primary/40">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
                      {s.n}
                    </p>
                    <h3 className="heading-display text-xl text-foreground mb-2.5">{s.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-12 text-center">
              <Button
                size="lg"
                className="h-12 rounded-xl px-6 text-base gap-2"
                onClick={() => navigate('/publier-nouveaute')}
              >
                <Megaphone className="h-5 w-5" />
                Publier ma première nouveauté
              </Button>
            </Reveal>
          </div>
        </section>

        {/* ============================= INSPIRATION ============================= */}
        <section className="bg-muted/40 border-y border-border">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <Reveal className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-[46ch]">
                <h2 className="heading-display text-[clamp(1.6rem,2.6vw,2.2rem)] text-foreground">
                  En panne d'inspiration ?
                </h2>
                <p className="mt-3 text-foreground/70">
                  Parcourez les nouveautés déjà publiées par d'autres exposants : produits,
                  démonstrations, lancements, conférences. De quoi voir ce qui fonctionne avant
                  d'écrire la vôtre.
                </p>
              </div>
              <Link to="/nouveautes" className="shrink-0">
                <Button variant="outline" className="h-12 rounded-xl px-6 text-base gap-2">
                  Voir toutes les nouveautés
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ============================= FAQ ============================= */}
        <section className="bg-background">
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
              Votre prochain salon commence maintenant.
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-[52ch] mx-auto">
              Publier votre nouveauté est gratuit. Le temps que vous y passez, vous le récupérez en
              visites qui savent déjà pourquoi elles viennent.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link to="/publier-nouveaute">
                <Button className="h-12 rounded-xl bg-background px-6 text-base text-primary hover:bg-background/90">
                  Publier ma nouveauté
                  <Megaphone className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <span className="text-sm text-primary-foreground/60">ou</span>
              <Link to="/nouveautes">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Voir des exemples
                </Button>
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
