import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Users,
  Link2,
  Sparkles,
  ShieldCheck,
  Handshake,
  LayoutGrid,
  TrendingUp,
  MousePointerClick,
  FileText,
  Megaphone,
  Gift,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Check,
  Minus,
  BadgeEuro,
  Target,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: Eye,
    title: 'Plus de visibilité pré-salon',
    text: 'Votre salon peut être découvert par des visiteurs professionnels qui recherchent des événements par secteur, ville ou date.',
  },
  {
    icon: MousePointerClick,
    title: 'Plus de trafic vers votre site officiel',
    text: "Lotexpo oriente les utilisateurs vers vos pages officielles pour l'inscription, les informations pratiques ou les demandes exposants.",
  },
  {
    icon: Users,
    title: 'Des exposants mieux valorisés',
    text: "Les Nouveautés donnent aux visiteurs des raisons concrètes de s'intéresser aux stands avant le salon.",
  },
  {
    icon: FileText,
    title: 'Une préparation de visite plus utile',
    text: "Les visiteurs peuvent identifier les innovations, démonstrations, produits et services à découvrir avant même l'ouverture.",
  },
  {
    icon: Megaphone,
    title: 'Un relais complémentaire à vos actions marketing',
    text: 'Lotexpo soutient votre communication sans remplacer vos canaux officiels.',
  },
  {
    icon: Gift,
    title: 'Un service gratuit pour les organisateurs',
    text: "Le référencement d'un salon professionnel sur Lotexpo ne nécessite aucun paiement.",
  },
];

const IS_LIST = [
  'Un annuaire spécialisé des salons professionnels en France.',
  'Un point d\u2019entrée complémentaire vers votre événement.',
  'Un relais vers votre site officiel, votre billetterie et vos informations pratiques.',
  'Un espace où vos exposants peuvent publier leurs Nouveautés.',
  'Un outil d\u2019aide à la préparation de visite pour un public professionnel.',
];

const IS_NOT_LIST = [
  'Une billetterie qui remplace votre système d\u2019inscription.',
  'Un site officiel qui se substitue à votre communication.',
  'Un partenaire officiel, sauf mention explicite.',
  'Un concurrent de votre salon.',
  'Une plateforme qui revendique l\u2019organisation de votre événement.',
];

const PROBLEM_CARDS = [
  {
    title: 'Les visiteurs comparent plusieurs salons',
    text: "Un professionnel ne choisit pas toujours un salon parce qu'il connaît son nom. Il compare les secteurs, les dates, les exposants, les nouveautés et l'intérêt concret du déplacement.",
  },
  {
    title: 'Les exposants communiquent chacun de leur côté',
    text: 'Chaque exposant annonce ses produits, démonstrations ou temps forts sur ses propres canaux. Lotexpo permet de regrouper ces signaux autour de votre événement.',
  },
  {
    title: 'Les bonnes raisons de venir ne sont pas toujours visibles',
    text: "Un salon peut être très pertinent, mais si les visiteurs ne voient pas rapidement ce qu'ils pourront y découvrir, ils peuvent passer à côté.",
  },
];

type SectionBlock = {
  icon: typeof Eye;
  title: string;
  body: React.ReactNode;
  highlight?: string;
  cta?: { label: string; to: string };
};

const SECTIONS: SectionBlock[] = [
  {
    icon: Eye,
    title: 'Une visibilité gratuite au moment où les visiteurs préparent leur venue',
    body: (
      <>
        <p>
          Chaque page événement publiée sur Lotexpo permet à votre salon d'être découvert par des visiteurs qui recherchent des événements professionnels par secteur, ville, région, date ou type d'activité. Cette visibilité est gratuite et agit en complément de vos actions de communication.
        </p>
        <p>
          L'objectif n'est pas de détourner les visiteurs de votre site officiel, mais de créer un point d'entrée supplémentaire vers votre événement. Lorsqu'un utilisateur veut s'inscrire, vérifier les informations pratiques ou contacter l'organisateur, Lotexpo le renvoie vers vos supports officiels.
        </p>
      </>
    ),
    highlight:
      "Votre site officiel reste la source de référence. Lotexpo aide simplement davantage de visiteurs qualifiés à y arriver.",
  },
  {
    icon: TrendingUp,
    title: "Un canal supplémentaire pour transformer l'intérêt en intention de visite",
    body: (
      <>
        <p>
          Les visiteurs qui consultent Lotexpo ne cherchent pas seulement une date ou une adresse. Ils veulent comprendre <strong className="text-foreground">pourquoi un salon mérite leur déplacement</strong>, quels exposants seront présents et quelles nouveautés peuvent justifier une visite.
        </p>
        <p>
          En centralisant ces informations, Lotexpo aide les visiteurs à passer d'une attention vague à une intention de visite plus claire. Un visiteur qui sait pourquoi il vient est plus susceptible de s'inscrire, de se déplacer et de passer du temps utile sur le salon.
        </p>
      </>
    ),
    highlight:
      "Résultat : votre événement gagne en visibilité avant son ouverture, auprès de visiteurs qui cherchent activement des salons à fort intérêt professionnel.",
  },
  {
    icon: Link2,
    title: 'Un point d\u2019entrée web supplémentaire vers votre site officiel',
    body: (
      <>
        <p>
          Une page Lotexpo crée une présence complémentaire pour votre salon dans un environnement spécialisé, orienté événements professionnels. Elle permet à des visiteurs, exposants potentiels, acheteurs, commerciaux ou partenaires de découvrir votre événement lorsqu'ils recherchent des salons par secteur, ville ou période.
        </p>
        <p>
          Lotexpo ne cherche pas à remplacer votre référencement naturel. La plateforme ajoute simplement une porte d'entrée supplémentaire vers vos informations officielles, dans un contexte où les utilisateurs comparent plusieurs événements avant de faire leur choix.
        </p>
      </>
    ),
    highlight:
      'Plus votre salon est visible dans des environnements cohérents et spécialisés, plus il augmente ses chances d\u2019être découvert par des publics complémentaires.',
  },
  {
    icon: Sparkles,
    title: 'Vos exposants deviennent aussi des relais de visibilité',
    body: (
      <>
        <p>
          Un salon vit grâce à ses exposants. Ce sont souvent leurs innovations, démonstrations, lancements produits, conférences, offres spéciales ou animations de stand qui donnent aux visiteurs une raison concrète de se déplacer.
        </p>
        <p>
          Avec Lotexpo, vos exposants peuvent{' '}
          <Link to="/nouveautes" className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">
            publier des Nouveautés
          </Link>{' '}
          liées à leur participation. Chaque Nouveauté devient un signal pré-salon : elle aide les visiteurs à comprendre ce qu'ils pourront découvrir et à préparer leur parcours.
        </p>
      </>
    ),
    highlight:
      "Les exposants créent du contenu utile, les visiteurs identifient plus facilement les stands à ne pas manquer, et votre salon bénéficie d'une attention mieux structurée avant son ouverture.",
  },
  {
    icon: ShieldCheck,
    title: 'Un outil complémentaire, pas un concurrent',
    body: (
      <>
        <p>
          Lotexpo ne remplace ni le site officiel du salon, ni la billetterie, ni l'espace exposant, ni les actions marketing de l'organisateur. La plateforme agit comme une couche de découverte et de préparation en amont.
        </p>
        <p>
          Votre site officiel reste l'endroit où les visiteurs doivent retrouver les informations contractuelles, les modalités d'inscription, les informations pratiques et les communications officielles. Lotexpo sert à aider davantage de professionnels à découvrir votre salon et à comprendre pourquoi il peut les intéresser.
        </p>
      </>
    ),
    highlight:
      "En résumé : Lotexpo ne capte pas l'attention à votre place. Il aide à canaliser une attention déjà dispersée vers votre événement.",
  },
  {
    icon: ShieldCheck,
    title: 'Un fonctionnement transparent',
    body: (
      <>
        <p>
          Lotexpo agrège et structure des informations publiques sur les salons professionnels afin de les rendre plus faciles à trouver, comparer et préparer.
        </p>
        <p>
          La présence d'un événement sur Lotexpo ne constitue pas une affiliation officielle avec l'organisateur, sauf mention explicite. Si vous représentez un salon et souhaitez corriger, compléter ou mettre à jour les informations affichées, vous pouvez{' '}
          <a
            href="https://lotexpo.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
          >
            nous contacter
          </a>
          .
        </p>
      </>
    ),
    cta: { label: 'Demander une correction', to: '/contact' },
  },
  {
    icon: Handshake,
    title: 'Un partenariat possible pour mieux valoriser vos exposants',
    body: (
      <>
        <p>
          Les organisateurs qui souhaitent aller plus loin peuvent encourager leurs exposants à publier leurs Nouveautés sur Lotexpo avant le salon. Cette démarche ne remplace pas votre communication officielle : elle crée une couche supplémentaire de contenu utile pour les visiteurs.
        </p>
        <p>
          Plus vos exposants publient ce qu'ils présenteront, plus les visiteurs peuvent préparer leur parcours. Votre salon devient alors plus lisible, plus vivant et plus concret avant même l'ouverture.
        </p>
      </>
    ),
    cta: { label: 'Proposer Lotexpo à mes exposants', to: '/contact' },
  },
];

const FAQ = [
  {
    q: 'Lotexpo est-il affilié à notre salon ?',
    a: "Non. Lotexpo est une plateforme indépendante. La présence d'un événement sur Lotexpo ne signifie pas que Lotexpo est affilié à l'organisateur, partenaire officiel ou mandaté par lui, sauf mention explicite.",
  },
  {
    q: 'Pourquoi notre salon est-il présent sur Lotexpo ?',
    a: "Lotexpo référence les salons professionnels en France afin d'aider les visiteurs, exposants et professionnels à identifier les événements utiles dans leur secteur. L'objectif est de rendre les salons plus faciles à découvrir et de rediriger les utilisateurs vers les informations officielles de chaque événement.",
  },
  {
    q: 'Lotexpo remplace-t-il notre site officiel ?',
    a: "Non. Votre site officiel reste la source de référence pour l'inscription, les informations pratiques, les conditions de participation et les communications officielles. Lotexpo agit comme un point d'entrée complémentaire.",
  },
  {
    q: 'Est-ce payant pour les organisateurs ?',
    a: "Non. Le référencement d'un salon professionnel sur Lotexpo est gratuit.",
  },
  {
    q: 'Pouvons-nous corriger ou compléter les informations affichées ?',
    a: "Oui. Si vous représentez un salon et souhaitez corriger, compléter ou mettre à jour une information, vous pouvez contacter Lotexpo.",
  },
  {
    q: 'Pouvons-nous encourager nos exposants à publier leurs Nouveautés ?',
    a: "Oui. C'est même l'un des meilleurs usages de Lotexpo. Les exposants peuvent publier ce qu'ils présenteront sur le salon afin d'aider les visiteurs à préparer leur parcours et à identifier les stands à visiter.",
  },
  {
    q: 'Lotexpo risque-t-il de détourner les visiteurs de notre site officiel ?',
    a: "Non. Lotexpo est conçu comme un point d'entrée complémentaire. Lorsqu'un utilisateur cherche à s'inscrire, consulter les informations officielles ou contacter l'organisateur, il est redirigé vers les supports officiels du salon.",
  },
  {
    q: 'Pourquoi les Nouveautés exposants sont-elles utiles pour un organisateur ?',
    a: "Parce qu'elles donnent aux visiteurs des raisons concrètes de venir. Un salon n'est pas seulement une date et un lieu : ce sont aussi des produits, innovations, démonstrations, conférences et rencontres. Les Nouveautés rendent cette valeur plus visible avant l'ouverture.",
  },
];

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
          content="Lotexpo aide les organisateurs de salons professionnels à gagner en visibilité, valoriser leurs exposants et attirer un public qualifié gratuitement."
        />
        <link rel="canonical" href="https://lotexpo.com/organisateurs" />
        <meta property="og:title" content="Organisateurs de salons professionnels | Lotexpo" />
        <meta
          property="og:description"
          content="Lotexpo aide les organisateurs de salons professionnels à gagner en visibilité, valoriser leurs exposants et attirer un public qualifié gratuitement."
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
        {/* Hero */}
        <section className="bg-secondary py-16 md:py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              Visibilité pré-salon
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Aidez les bons visiteurs à choisir votre salon avant même l'ouverture
            </h1>
            <div className="space-y-4 text-base md:text-lg text-muted-foreground text-left max-w-3xl mx-auto">
              <p>
                Lotexpo référence les salons professionnels en France pour aider les visiteurs, exposants et équipes commerciales à identifier les événements utiles dans leur secteur. La plateforme agit comme un point d'entrée complémentaire : elle rend votre salon plus facile à découvrir, valorise vos exposants et redirige les utilisateurs vers vos informations officielles.
              </p>
              <p>
                Votre site officiel reste la destination de référence. Lotexpo intervient en amont, au moment où les visiteurs comparent les salons, cherchent des exposants à rencontrer et décident si le déplacement mérite leur temps.
              </p>
            </div>
            {/* Mini-cards badges */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                {
                  icon: BadgeEuro,
                  title: '100% gratuit',
                  text: 'Référencement sans frais pour les salons professionnels.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Indépendant',
                  text: "Lotexpo n'est pas affilié aux organisateurs, sauf mention explicite.",
                },
                {
                  icon: Target,
                  title: 'Orienté visiteurs qualifiés',
                  text: 'Votre salon est découvert par des professionnels qui préparent activement leur venue.',
                },
              ].map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.title}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                  >
                    <div className="bg-primary/10 rounded-xl p-2.5 w-fit mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">{badge.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{badge.text}</p>
                  </div>
                );
              })}
            </div>
            {/* Highlighted phrase */}
            <div className="mt-8 max-w-3xl mx-auto rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-left">
              <p className="text-sm md:text-base text-foreground font-medium">
                Lotexpo ne remplace pas votre site officiel. La plateforme crée un point d'entrée supplémentaire vers votre salon, vos exposants et vos informations officielles.
              </p>
            </div>
            <div className="mt-8">
              <Button asChild size="lg" className="gap-2">
                <Link to="/contact">
                  Vérifier la fiche de mon salon <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Lotexpo est / n'est pas */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-4 max-w-3xl mx-auto">
              Une plateforme indépendante, pensée pour renforcer votre visibilité
            </h2>
            <p className="text-base md:text-lg text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Lotexpo clarifie son rôle pour que les organisateurs gardent la maîtrise de leur communication officielle.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                <h3 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  Lotexpo est
                </h3>
                <ul className="space-y-3">
                  {IS_LIST.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-muted-foreground">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/40 border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                <h3 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                  Lotexpo n'est pas
                </h3>
                <ul className="space-y-3">
                  {IS_NOT_LIST.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-muted-foreground">
                      <Minus className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 text-center">
              <p className="text-base text-foreground font-medium">
                Notre objectif est simple : rendre les salons professionnels plus faciles à découvrir, sans prendre la place des organisateurs.
              </p>
            </div>
          </div>
        </section>

        {/* Le problème : attention dispersée */}
        <section className="py-16 px-4 bg-secondary">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-4 max-w-3xl mx-auto">
              Le problème : l'attention autour d'un salon est souvent dispersée
            </h2>
            <p className="text-base md:text-lg text-muted-foreground text-center mb-10 max-w-3xl mx-auto">
              Avant un salon, les visiteurs reçoivent des emails, voient des posts LinkedIn, consultent parfois le site officiel, découvrent quelques exposants ou téléchargent un programme. Mais ces informations sont rarement centralisées au moment où ils décident réellement si le salon mérite leur déplacement.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PROBLEM_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-bold text-foreground mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rhythmic sections with alternating backgrounds */}
        {SECTIONS.map((section, index) => {
          const Icon = section.icon;
          const tinted = index % 2 === 1;
          return (
            <section
              key={section.title}
              className={`py-14 px-4 ${tinted ? 'bg-secondary' : 'bg-background'}`}
            >
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-5">
                <div className="shrink-0">
                  <div className="bg-primary/10 rounded-2xl p-3 w-fit">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground mb-4">{section.title}</h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    {section.body}
                  </div>
                  {section.highlight && (
                    <div className="mt-5 rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3">
                      <p className="text-sm md:text-base text-foreground font-medium">
                        {section.highlight}
                      </p>
                    </div>
                  )}
                  {section.cta && (
                    <Button asChild variant="outline" className="mt-5 gap-2">
                      <Link to={section.cta.to}>
                        {section.cta.label} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {/* Widget section */}
        <section className="py-16 px-4 bg-background">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="bg-primary/10 rounded-2xl p-3 w-fit mb-5">
                <LayoutGrid className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Affichez les temps forts de vos exposants sur votre site officiel
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  Le widget Lotexpo permet d'intégrer sur le site officiel de votre salon les Nouveautés publiées par vos exposants : lancements produits, innovations, démonstrations, conférences, animations de stand ou documents à télécharger.
                </p>
                <p>
                  Vous enrichissez ainsi votre site avec du contenu utile, vivant et orienté visiteurs, <strong className="text-foreground">sans devoir tout produire vous-même</strong>. Les exposants gagnent en visibilité, les visiteurs préparent mieux leur venue, et votre salon bénéficie d'un contenu plus attractif avant son ouverture.
                </p>
                <p>
                  Le widget ne remplace pas vos pages officielles. Il ajoute un bloc de contenu dynamique pour mettre en avant ce que vos exposants souhaitent présenter.
                </p>
              </div>
              <Button asChild className="mt-6 gap-2">
                <Link to="/contact">
                  Demander l'intégration du widget <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            {/* Widget mockup */}
            <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Fake browser bar */}
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-destructive/60" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs font-medium text-muted-foreground">
                  Site officiel du salon
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Nouveautés des exposants</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { title: 'Lancement de notre gamme éco-responsable', exhibitor: 'NovaTech' },
                    { title: 'Démonstration en direct sur le stand', exhibitor: 'AtelierPro' },
                    { title: 'Offre spéciale réservée aux visiteurs', exhibitor: 'GreenLine' },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                    >
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{card.title}</p>
                        <p className="text-[11px] text-muted-foreground">{card.exhibitor}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                        Découvrir
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits grid */}
        <section className="bg-secondary py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
              Ce que votre salon gagne avec Lotexpo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={benefit.title}
                    className="bg-card border border-border rounded-2xl p-6 shadow-sm"
                  >
                    <div className="bg-primary/10 rounded-xl p-3 w-fit mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
              Questions fréquentes
            </h2>
            <div className="space-y-6">
              {FAQ.map((item) => (
                <div key={item.q} className="border border-border rounded-2xl p-6 bg-card">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    {item.q}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed pl-7">
                    {item.q === 'Pouvons-nous corriger ou compléter les informations affichées ?' ? (
                      <>
                        Oui. Si vous représentez un salon et souhaitez corriger, compléter ou mettre à jour une information, vous pouvez{' '}
                        <Link to="/contact" className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">
                          contacter Lotexpo
                        </Link>
                        .
                      </>
                    ) : (
                      item.a
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary text-primary-foreground py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Vous organisez un salon professionnel ?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Lotexpo peut vous aider à renforcer gratuitement la visibilité de votre événement, valoriser vos exposants et attirer un public plus qualifié.
            </p>
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link to="/contact">
                Contacter Lotexpo <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Organisateurs;
