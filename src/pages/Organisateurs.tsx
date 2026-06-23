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
    title: 'Plus de visibilité gratuite',
    text: 'Votre salon peut être découvert par des visiteurs professionnels qui recherchent des événements par secteur, ville ou date.',
  },
  {
    icon: MousePointerClick,
    title: 'Plus de trafic vers votre site officiel',
    text: "Lotexpo peut orienter les utilisateurs vers vos pages officielles pour l'inscription, les informations pratiques ou les demandes exposants.",
  },
  {
    icon: Users,
    title: 'Des exposants mieux valorisés',
    text: 'Les fiches exposants et les Nouveautés donnent plus de raisons concrètes aux visiteurs de préparer leur venue.',
  },
  {
    icon: FileText,
    title: 'Un contenu utile avant le salon',
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
  'Un canal de visibilité supplémentaire pour votre événement.',
  'Un relais vers votre site officiel et vos informations pratiques.',
  'Un espace où vos exposants peuvent publier leurs Nouveautés.',
  'Un outil complémentaire pour attirer un public plus qualifié.',
];

const IS_NOT_LIST = [
  'Une billetterie qui remplace votre système d\u2019inscription.',
  'Un site officiel qui se substitue à votre communication.',
  'Un partenaire officiel, sauf mention explicite.',
  'Un concurrent de votre salon.',
  'Une plateforme qui revendique l\u2019organisation de votre événement.',
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
    title: 'Une visibilité gratuite pour votre salon',
    body: (
      <>
        <p>
          Chaque page événement publiée sur Lotexpo permet à votre salon d'être découvert par des visiteurs qui recherchent des événements professionnels par secteur, ville, région, date ou type d'activité.
        </p>
        <p>
          <strong className="text-foreground">Cette visibilité est entièrement gratuite.</strong> Aucun paiement n'est demandé pour référencer un salon professionnel. L'objectif est de créer un point d'entrée complémentaire vers votre événement, en particulier pour les visiteurs qui comparent plusieurs salons avant de se déplacer.
        </p>
      </>
    ),
    highlight:
      "Lotexpo ne remplace pas votre site officiel : la plateforme agit comme une porte d'entrée supplémentaire qui redirige les utilisateurs vers vos supports officiels.",
  },
  {
    icon: TrendingUp,
    title: 'Un canal supplémentaire pour attirer un public qualifié',
    body: (
      <>
        <p>
          Les visiteurs qui consultent Lotexpo ne cherchent pas seulement une date ou une adresse. Ils veulent comprendre <strong className="text-foreground">pourquoi un salon mérite leur déplacement</strong>, quels exposants seront présents et quelles nouveautés peuvent justifier une visite.
        </p>
        <p>
          En centralisant ces informations, Lotexpo aide les visiteurs à mieux préparer leur venue. Un visiteur mieux informé est plus susceptible de s'inscrire, de venir sur place et de passer du temps sur le salon.
        </p>
      </>
    ),
    highlight:
      "Résultat : plus d'intérêt autour de votre événement avant son ouverture, sans travail supplémentaire de votre part.",
  },
  {
    icon: Link2,
    title: 'Des backlinks et une meilleure présence sur le web',
    body: (
      <>
        <p>
          Lorsqu'une page Lotexpo renvoie vers votre site officiel, elle crée un point d'accès supplémentaire vers vos contenus. Cette présence peut contribuer à renforcer votre visibilité globale sur le web, <strong className="text-foreground">sans se substituer à votre stratégie SEO</strong>.
        </p>
        <p>
          Plus un salon est mentionné sur des plateformes pertinentes, plus il augmente ses chances d'être découvert par des publics complémentaires : visiteurs professionnels, exposants potentiels, acheteurs, prescripteurs, commerciaux ou partenaires.
        </p>
        <p>
          Être présent sur Lotexpo permet à votre événement d'apparaître dans un environnement spécialisé, cohérent et orienté business.
        </p>
      </>
    ),
  },
  {
    icon: Sparkles,
    title: 'Vos exposants deviennent aussi des relais de visibilité',
    body: (
      <>
        <p>
          Un salon vit grâce à ses exposants. Ce sont souvent leurs innovations, démonstrations, lancements produits ou temps forts qui donnent envie aux visiteurs de se déplacer.
        </p>
        <p>
          Avec Lotexpo, vos exposants peuvent{' '}
          <Link to="/nouveautes" className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">
            publier des Nouveautés
          </Link>{' '}
          liées à leur participation : lancement produit, démonstration, innovation, offre spéciale, conférence, animation de stand ou document à télécharger.
        </p>
        <p>
          Chaque Nouveauté publiée devient une raison concrète de venir sur votre salon. Les exposants créent du contenu, ce contenu attire l'attention, et cette attention renforce l'intérêt autour de votre événement.
        </p>
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Un outil complémentaire, pas un concurrent',
    body: (
      <>
        <p>
          Lotexpo ne remplace pas le site officiel du salon, la billetterie, l'espace exposant ou les actions marketing de l'organisateur.
        </p>
        <p>
          La plateforme agit comme une couche de visibilité supplémentaire. Elle aide les utilisateurs à découvrir les salons, à comparer les événements professionnels et à préparer leur venue. <strong className="text-foreground">Les informations officielles restent celles de l'organisateur.</strong>
        </p>
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Un fonctionnement transparent',
    body: (
      <>
        <p>
          Lotexpo agrège et structure des informations publiques sur les salons professionnels afin de les rendre plus faciles à trouver et à comparer.
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
  },
  {
    icon: Handshake,
    title: 'Un partenariat possible avec les organisateurs',
    body: (
      <>
        <p>
          Les organisateurs qui souhaitent aller plus loin peuvent encourager leurs exposants à publier leurs Nouveautés sur Lotexpo avant le salon.
        </p>
        <p>
          Cela crée une dynamique de communication avant l'événement : les exposants valorisent ce qu'ils vont présenter, les visiteurs identifient plus facilement les stands à ne pas manquer, et le salon bénéficie d'une visibilité accrue.
        </p>
      </>
    ),
    cta: { label: 'Proposer Lotexpo à vos exposants', to: '/contact' },
  },
];

const FAQ = [
  {
    q: 'Lotexpo est-il affilié à notre salon ?',
    a: "Non. Lotexpo est une plateforme indépendante. La présence d'un événement sur Lotexpo ne signifie pas que Lotexpo est affilié à l'organisateur, partenaire officiel ou mandaté par lui, sauf mention explicite.",
  },
  {
    q: 'Pourquoi notre salon est-il présent sur Lotexpo ?',
    a: "Lotexpo référence les salons professionnels en France afin d'aider les visiteurs et les exposants à identifier les événements utiles dans leur secteur. L'objectif est de donner plus de visibilité aux salons professionnels.",
  },
  {
    q: 'Est-ce payant pour les organisateurs ?',
    a: "Non. Le référencement d'un salon professionnel sur Lotexpo est gratuit.",
  },
  {
    q: 'Lotexpo remplace-t-il notre site officiel ?',
    a: "Non. Lotexpo ne remplace pas le site officiel du salon. La plateforme agit comme un point d'entrée complémentaire et peut rediriger les utilisateurs vers les supports officiels de l'organisateur.",
  },
  {
    q: 'Pouvons-nous corriger ou compléter les informations affichées ?',
    a: "Oui. Si vous représentez un salon et souhaitez corriger, compléter ou mettre à jour une information, vous pouvez contacter Lotexpo.",
  },
  {
    q: 'Pouvons-nous encourager nos exposants à publier leurs Nouveautés ?',
    a: "Oui. C'est même l'un des meilleurs usages de Lotexpo. Les exposants peuvent publier ce qu'ils présenteront sur le salon afin d'aider les visiteurs à préparer leur parcours et à identifier les stands à visiter.",
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
              Plateforme indépendante
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Organisateurs de salons : donnez plus de visibilité à votre événement
            </h1>
            <div className="space-y-4 text-base md:text-lg text-muted-foreground text-left max-w-3xl mx-auto">
              <p>
                Lotexpo référence les salons professionnels organisés en France afin d'aider les visiteurs, exposants à identifier les événements qui comptent dans leur secteur.
              </p>
              <p>
                La plateforme est indépendante. La présence d'un salon sur Lotexpo ne signifie pas que Lotexpo est affilié à l'organisateur, partenaire officiel ou mandaté par lui, sauf mention explicite. Notre rôle est simple : offrir une visibilité supplémentaire aux événements professionnels et orienter les utilisateurs vers les informations utiles, notamment le site officiel de chaque salon.
              </p>
              <p>
                Pour les organisateurs, Lotexpo est une opportunité gratuite de renforcer la visibilité de leur événement, de mettre en avant leurs exposants et de générer davantage d'intérêt avant l'ouverture du salon.
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
                  title: 'Visibilité qualifiée',
                  text: 'Votre salon est découvert par des visiteurs, exposants et commerciaux.',
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
                  Nous contacter <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Lotexpo est / n'est pas */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10 max-w-3xl mx-auto">
              Une plateforme indépendante, pensée pour renforcer votre visibilité
            </h2>
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
                Notre objectif est simple : donner plus de visibilité aux salons professionnels, sans prendre la place des organisateurs.
              </p>
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
                Affichez les Nouveautés de vos exposants directement sur votre site
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  Le widget Lotexpo permet d'intégrer sur le site officiel de votre salon les Nouveautés publiées par vos exposants.
                </p>
                <p>
                  Concrètement, vos exposants publient leurs temps forts sur Lotexpo : lancement produit, innovation, démonstration, conférence, animation de stand ou document à télécharger. Ces contenus peuvent ensuite être affichés sur votre propre site grâce au widget.
                </p>
                <p>
                  Vous enrichissez ainsi votre site avec du contenu utile, vivant et orienté visiteurs, <strong className="text-foreground">sans devoir tout produire vous-même</strong>. Les exposants gagnent en visibilité, les visiteurs préparent mieux leur venue, et votre salon bénéficie d'un contenu plus attractif avant son ouverture.
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

        {/* CTA before FAQ */}
        <section className="py-16 px-4 bg-background">
          <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-secondary px-6 py-10 md:px-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Vous voulez enrichir la page de votre salon ?
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-8">
              Si vous représentez un salon professionnel, vous pouvez nous transmettre vos informations officielles, demander une correction, proposer un partenariat ou découvrir comment intégrer le widget Lotexpo sur votre site.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="gap-2">
                <Link to="/contact">
                  Nous contacter <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/nouveautes">
                  Découvrir les Nouveautés <Sparkles className="w-4 h-4" />
                </Link>
              </Button>
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
