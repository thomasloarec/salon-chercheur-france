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
} from 'lucide-react';

const BENEFITS = [
  {
    icon: Eye,
    title: 'Plus de visibilité gratuite',
    text: 'Votre événement peut être découvert par des visiteurs professionnels qui recherchent des salons par secteur, ville ou date.',
  },
  {
    icon: MousePointerClick,
    title: 'Un trafic qualifié vers votre site officiel',
    text: "Lotexpo peut orienter les utilisateurs vers vos pages officielles pour l'inscription, les informations pratiques ou les demandes exposants.",
  },
  {
    icon: Users,
    title: 'Une meilleure mise en valeur de vos exposants',
    text: 'Les fiches exposants et les Nouveautés donnent plus de raisons concrètes aux visiteurs de préparer leur venue.',
  },
  {
    icon: FileText,
    title: 'Un contenu utile avant le salon',
    text: "Les visiteurs peuvent identifier les innovations, démonstrations, produits ou services à découvrir avant même l'ouverture de l'événement.",
  },
  {
    icon: Megaphone,
    title: 'Un relais complémentaire à vos actions marketing',
    text: 'Lotexpo peut soutenir vos campagnes de communication sans remplacer vos canaux officiels.',
  },
  {
    icon: Gift,
    title: 'Un service gratuit pour les organisateurs',
    text: "Le référencement d'un salon professionnel sur Lotexpo ne nécessite aucun paiement.",
  },
];

const SECTIONS = [
  {
    icon: Eye,
    title: 'Une visibilité gratuite pour votre salon',
    paragraphs: [
      "Chaque page événement publiée sur Lotexpo permet à votre salon d'être découvert par des visiteurs qui recherchent des événements professionnels par secteur, ville, région, date ou type d'activité.",
      "Cette visibilité est gratuite. Aucun paiement n'est demandé pour référencer un salon professionnel sur Lotexpo. L'objectif est de créer un point d'entrée complémentaire vers votre événement, en particulier pour les visiteurs qui ne connaissent pas encore votre marque ou qui comparent plusieurs salons avant de se déplacer.",
      "Lotexpo ne remplace pas votre site officiel. Au contraire, la plateforme agit comme une porte d'entrée supplémentaire qui peut rediriger les utilisateurs vers vos supports officiels lorsque ces informations sont disponibles.",
    ],
  },
  {
    icon: TrendingUp,
    title: 'Un canal supplémentaire pour attirer un public qualifié',
    paragraphs: [
      "Les visiteurs qui consultent Lotexpo ne cherchent pas seulement une date ou une adresse. Ils veulent comprendre pourquoi un salon mérite leur déplacement, quels exposants seront présents et quelles nouveautés peuvent justifier une visite.",
      "En centralisant ces informations, Lotexpo aide les visiteurs à mieux préparer leur venue. Cela bénéficie directement aux organisateurs, car un visiteur mieux informé est plus susceptible de s'inscrire, de venir sur place et de passer du temps sur le salon.",
      "Lotexpo permet donc de renforcer l'intérêt autour de votre événement avant son ouverture, sans travail supplémentaire de votre part.",
    ],
  },
  {
    icon: Link2,
    title: 'Des backlinks et une meilleure présence sur le web',
    paragraphs: [
      "Lorsqu'une page événement renvoie vers le site officiel du salon, cela crée un point d'accès supplémentaire vers vos contenus. Cette présence peut contribuer à renforcer la visibilité globale de votre événement sur le web.",
      "Plus un salon est mentionné sur des plateformes pertinentes, plus il augmente ses chances d'être découvert par des publics complémentaires : visiteurs professionnels, exposants potentiels, acheteurs, prescripteurs, commerciaux ou partenaires.",
      "Lotexpo a vocation à devenir une plateforme de référence pour les salons professionnels en France. Être présent sur Lotexpo permet à votre événement d'apparaître dans un environnement spécialisé, cohérent et orienté business.",
    ],
  },
  {
    icon: Sparkles,
    title: 'Vos exposants deviennent aussi des relais de visibilité',
    paragraphs: [
      "Un salon vit grâce à ses exposants. C'est souvent ce qu'ils annoncent, lancent ou présentent qui donne envie aux visiteurs de se déplacer.",
      "Lotexpo permet aux exposants de publier des Nouveautés liées à leur participation à un salon : lancement produit, démonstration, innovation, offre spéciale, conférence, animation de stand ou document à télécharger.",
      "Chaque Nouveauté publiée peut donner une raison concrète à un visiteur de venir sur le salon. Pour l'organisateur, c'est une mécanique vertueuse : les exposants créent du contenu, ce contenu attire l'attention, et cette attention renforce l'intérêt autour de l'événement.",
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Un outil complémentaire, pas un concurrent',
    paragraphs: [
      "Lotexpo ne remplace pas le site officiel du salon, la billetterie, l'espace exposant ou les actions marketing de l'organisateur.",
      "La plateforme agit comme une couche de visibilité supplémentaire. Elle aide les utilisateurs à découvrir les salons, à comparer les événements professionnels et à préparer leur venue. Les informations officielles restent celles de l'organisateur.",
      "Lorsque cela est pertinent, Lotexpo peut rediriger les utilisateurs vers le site officiel de l'événement pour l'inscription, les informations pratiques ou les demandes exposants.",
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Un fonctionnement transparent',
    paragraphs: [
      "Lotexpo agrège et structure des informations publiques sur les salons professionnels afin de les rendre plus faciles à trouver et à comparer.",
      "La présence d'un événement sur Lotexpo ne constitue pas une affiliation officielle avec l'organisateur, sauf mention explicite. Si vous représentez un salon et souhaitez corriger, compléter ou mettre à jour les informations affichées, vous pouvez nous contacter.",
      "Notre objectif est de présenter les événements de manière utile, exacte et valorisante pour les visiteurs, les exposants et les organisateurs.",
    ],
  },
  {
    icon: Handshake,
    title: 'Un partenariat possible avec les organisateurs',
    paragraphs: [
      "Les organisateurs qui souhaitent aller plus loin peuvent encourager leurs exposants à publier leurs Nouveautés sur Lotexpo avant le salon.",
      "Cela permet de créer une dynamique de communication avant l'événement. Les exposants valorisent ce qu'ils vont présenter, les visiteurs identifient plus facilement les stands à ne pas manquer, et le salon bénéficie d'une visibilité accrue.",
      "Lotexpo peut devenir un support complémentaire à vos campagnes exposants, newsletters, réseaux sociaux et actions de promotion.",
    ],
    cta: { label: 'Proposer Lotexpo à vos exposants', to: '/contact' },
  },
  {
    icon: LayoutGrid,
    title: 'Un widget pour valoriser les Nouveautés sur votre propre site',
    paragraphs: [
      "À terme, Lotexpo pourra proposer aux organisateurs un widget à intégrer sur leur site officiel. Ce widget permettra d'afficher automatiquement les Nouveautés publiées par les exposants de leur salon.",
      "L'intérêt est simple : vos exposants créent du contenu sur Lotexpo, et ce contenu peut ensuite être réutilisé pour enrichir votre propre site événementiel.",
      "C'est un fonctionnement gagnant-gagnant. Les exposants gagnent en visibilité, les visiteurs découvrent plus facilement les temps forts du salon, et l'organisateur dispose d'un contenu vivant sans devoir tout produire lui-même.",
    ],
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
            <div className="mt-8">
              <Button asChild size="lg" className="gap-2">
                <Link to="/contact">
                  Nous contacter <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Sections */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <article key={section.title} className="flex flex-col md:flex-row gap-5">
                  <div className="shrink-0">
                    <div className="bg-primary/10 rounded-2xl p-3 w-fit">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground mb-4">{section.title}</h2>
                    <div className="space-y-3 text-muted-foreground leading-relaxed">
                      {section.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                    {section.cta && (
                      <Button asChild variant="outline" className="mt-5 gap-2">
                        <Link to={section.cta.to}>
                          {section.cta.label} <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Benefits grid */}
        <section className="bg-secondary py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
              Ce que Lotexpo apporte à votre salon
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
                  <p className="text-muted-foreground leading-relaxed pl-7">{item.a}</p>
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
