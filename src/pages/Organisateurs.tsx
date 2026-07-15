import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Users,
  Sparkles,
  ShieldCheck,
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
    text: "Nom, dates, secteurs, tarif, affluence, photo, description. Vous proposez vos modifications, nous les vérifions, puis elles remplacent les nôtres et ne sont plus jamais écrasées par nos imports.",
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
    title: 'Une porte d\u2019entrée supplémentaire vers votre salon officiel',
    body: (
      <>
        <p>
          Chaque page événement publiée sur Lotexpo permet à votre salon d'être découvert par des professionnels qui recherchent des événements par secteur, ville, région, date ou type d'activité. Cette visibilité est gratuite et agit en complément de vos actions de communication.
        </p>
        <p>
          Lotexpo ne cherche pas à remplacer votre site officiel. La plateforme crée un point d'entrée supplémentaire vers votre événement et redirige les utilisateurs vers vos supports officiels lorsqu'ils veulent s'inscrire, consulter les informations pratiques ou contacter l'organisateur.
        </p>
      </>
    ),
    highlight:
      "Votre site officiel reste la source de référence. Lotexpo aide simplement davantage de visiteurs qualifiés à y arriver.",
  },
  {
    icon: TrendingUp,
    title: "Transformer l'attention en intention de visite",
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
      "Lotexpo structure l'attention pré-salon pour aider les visiteurs à décider plus facilement si votre événement mérite leur temps.",
  },
  {
    icon: Sparkles,
    title: 'Vos exposants donnent des raisons concrètes de venir',
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
          liées à leur participation. Chaque Nouveauté devient un signal pré-salon : elle aide les visiteurs à comprendre ce qu'ils pourront découvrir et à préparer leur parcours avant l'ouverture.
        </p>
        <p>
          Les organisateurs qui souhaitent aller plus loin peuvent encourager leurs exposants à publier leurs Nouveautés sur Lotexpo. Plus les exposants valorisent ce qu'ils présenteront, plus le salon devient lisible, vivant et concret avant même le jour J.
        </p>
      </>
    ),
    highlight:
      "Les exposants créent le contenu, les visiteurs identifient les stands utiles, et votre salon bénéficie d'une attention mieux structurée.",
    cta: { label: 'Revendiquer mon salon', to: '/trouver-un-salon' },
  },
  {
    icon: ShieldCheck,
    title: 'Un fonctionnement transparent et maîtrisable',
    body: (
      <>
        <p>
          Lotexpo agrège et structure des informations publiques sur les salons professionnels afin de les rendre plus faciles à trouver, comparer et préparer.
        </p>
        <p>
          La présence d'un événement sur Lotexpo ne constitue pas une affiliation officielle avec l'organisateur, sauf mention explicite. Lotexpo ne remplace ni le site officiel du salon, ni la billetterie, ni l'espace exposant, ni les actions marketing de l'organisateur.
        </p>
        <p>
          Si vous représentez un salon, vous pouvez revendiquer sa page pour en devenir le gestionnaire officiel. Vous pourrez alors corriger et compléter vous-même les informations affichées, sans passer par nous à chaque fois.
        </p>
      </>
    ),
    highlight:
      "En résumé : Lotexpo ne capte pas l'attention à votre place. Il aide à canaliser une attention déjà dispersée vers votre événement officiel.",
    cta: { label: 'Revendiquer mon salon', to: '/trouver-un-salon' },
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
        {/* Hero */}
        <section className="bg-secondary py-16 md:py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              Espace organisateurs
            </span>
            <h1 className="heading-display text-3xl md:text-4xl text-foreground mb-6 leading-tight">
              Votre salon vous appartient. Sur Lotexpo aussi.
            </h1>
            <div className="space-y-4 text-base md:text-lg text-muted-foreground text-left max-w-3xl mx-auto">
              <p>
                Chaque jour, des professionnels viennent sur Lotexpo pour une seule raison : savoir quel salon mérite leur déplacement. Ils comparent les secteurs, les dates, les exposants et les nouveautés. Nous leur répondons avec les informations disponibles.
              </p>
              <p>
                Vous êtes les seuls à détenir la vérité sur votre événement. C'est pour cela que nous avons ouvert cet espace : pour que la référence sur votre salon soit la vôtre, et non la nôtre. Votre site officiel reste la destination. Lotexpo intervient en amont, au moment où le visiteur décide.
              </p>
            </div>
            {/* Mini-cards badges */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                {
                  icon: BadgeEuro,
                  title: 'Gratuit, sans engagement',
                  text: "Revendiquer et gérer votre salon ne coûte rien et ne vous engage à rien.",
                },
                {
                  icon: ShieldCheck,
                  title: 'Vous gardez la main',
                  text: "Une fois votre salon revendiqué, vos informations font foi. Nos imports automatiques ne les écrasent jamais.",
                },
                {
                  icon: Target,
                  title: "La visibilité ne s'achète pas",
                  text: "Aucun classement payant sur Lotexpo. Personne ne peut acheter une meilleure place que vous.",
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
                Lotexpo ne remplace pas votre site officiel et ne cherche pas à le remplacer. Chaque page renvoie vers vos supports officiels pour l'inscription, les informations pratiques et le contact.
              </p>
            </div>
            <div className="mt-8">
              <Button asChild size="lg" className="gap-2">
                <Link to="/trouver-un-salon">
                  Revendiquer mon salon <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">
                Recherchez votre salon, ouvrez sa page, puis cliquez sur Revendiquer.
              </p>
            </div>
          </div>
        </section>

        {/* Votre rôle sur Lotexpo */}
        <section className="py-16 px-4 bg-background">
          <div className="max-w-6xl mx-auto">
            <h2 className="heading-display text-2xl md:text-3xl text-foreground text-center mb-4 max-w-3xl mx-auto section-rule [&::before]:mx-auto">
              Ce que vous pouvez faire, dès maintenant
            </h2>
            <p className="text-base md:text-lg text-muted-foreground text-center mb-10 max-w-3xl mx-auto">
              Jusqu'ici, les organisateurs étaient les seuls acteurs de l'écosystème à ne rien pouvoir faire sur Lotexpo. Ce n'est plus le cas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ROLE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {idx + 1}
                      </span>
                      <div className="bg-primary/10 rounded-xl p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-10 text-center">
              <Button asChild size="lg" className="gap-2">
                <Link to="/trouver-un-salon">
                  Revendiquer mon salon <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Lotexpo est / n'est pas */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-display text-2xl md:text-3xl text-foreground text-center mb-4 max-w-3xl mx-auto section-rule [&::before]:mx-auto">
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
            <h2 className="heading-display text-2xl md:text-3xl text-foreground text-center mb-4 max-w-3xl mx-auto section-rule [&::before]:mx-auto">
              Pourquoi des informations complètes vous amènent des visiteurs plus qualifiés
            </h2>
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
            <div className="mt-8 max-w-3xl mx-auto rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4">
              <p className="text-sm md:text-base text-foreground font-medium">
                Nous ne décidons pas quels salons méritent d'être vus. Nous répondons avec ce que nous savons. Vous êtes les mieux placés pour nous le dire.
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
                  <h2 className="section-rule heading-display text-2xl text-foreground mb-4">{section.title}</h2>
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
              <h2 className="section-rule heading-display text-2xl md:text-3xl text-foreground mb-4">
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
            <h2 className="heading-display text-3xl md:text-4xl text-foreground text-center mb-12 section-rule [&::before]:mx-auto">
              Nos engagements envers vous
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
            <h2 className="heading-display text-3xl md:text-4xl text-foreground text-center mb-12 section-rule [&::before]:mx-auto">
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
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary text-primary-foreground py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-display text-3xl md:text-4xl mb-4">
              Votre salon est déjà sur Lotexpo. Prenez-en la main.
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              La revendication est gratuite et ne vous engage à rien.
            </p>
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link to="/trouver-un-salon">
                Revendiquer mon salon <ArrowRight className="w-4 h-4" />
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
