import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, TrendingUp, Users, Calendar, X, Search, Megaphone, LineChart, Sparkles, Target, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import MainLayout from '@/components/layout/MainLayout';
import { PremiumLeadDialog } from '@/components/premium/PremiumLeadDialog';

export default function Exposants() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  return (
    <>
      <Helmet>
        <title>Exposants | Maximisez votre ROI salon professionnel – Lotexpo</title>
        <meta 
          name="description" 
          content="Découvrez comment Lotexpo aide les exposants à maximiser leur ROI événementiel. Générez des leads qualifiés avant l'ouverture des salons B2B." 
        />
        <link rel="canonical" href="https://lotexpo.com/exposants" />
        <meta property="og:title" content="Exposants | Maximisez votre ROI salon professionnel – Lotexpo" />
        <meta property="og:url" content="https://lotexpo.com/exposants" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Salons", "item": "https://lotexpo.com" },
              { "@type": "ListItem", "position": 2, "name": "Exposants", "item": "https://lotexpo.com/exposants" }
            ]
          })}
        </script>
      </Helmet>
    <MainLayout title="Lotexpo pour les Exposants - Maximisez votre ROI événementiel">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 border-b">
        <div className="container max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center space-y-6 max-w-3xl mx-auto">

            {/* Headline */}
            <h1 className="heading-display text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight">
              Ne comptez plus sur le <span className="text-primary">hasard</span>
              <br />
              pour attirer les bons visiteurs
            </h1>

            {/* Sous-titre */}
            <p className="text-xl text-muted-foreground leading-relaxed">
              Publiez ce que vous présenterez sur votre stand et donnez aux visiteurs une raison de venir vous voir{' '}
              <strong className="text-foreground">avant même l'ouverture du salon</strong>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8 gap-2 shadow-lg"
                onClick={() => navigate('/publier-nouveaute')}
              >
                <Megaphone className="h-5 w-5" />
                Publier ma première nouveauté
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 gap-2"
                onClick={() => {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Crown className="h-5 w-5" />
                Découvrir le Premium
              </Button>
            </div>

            {/* Trust indicators */}
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-foreground" />
                1 nouveauté gratuite
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-foreground" />
                Sans carte bancaire
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-foreground" />
                Publication en quelques minutes
              </span>
            </p>
            <p className="text-sm text-muted-foreground/80">
              Ciblez les visiteurs qui préparent déjà leur venue.
            </p>
          </div>
        </div>

        {/* Pattern de fond subtil */}
        <div className="absolute inset-0 -z-10 opacity-10 pointer-events-none">
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
              backgroundSize: '48px 48px'
            }} 
          />
        </div>
      </section>

      {/* Section Problème/Solution */}
      <section className="py-16 border-b bg-muted/30">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Problème */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20">
                <X className="h-5 w-5 text-destructive" />
                <span className="text-sm font-semibold">Le problème</span>
              </div>
              
              <h2 className="section-rule heading-display text-3xl text-foreground leading-tight">
                Pourquoi tant d'exposants repartent avec le sentiment d'avoir subi leur salon ?
              </h2>

              <div className="space-y-4">
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Les visiteurs ne savent pas pourquoi venir vous voir :</strong> Votre nom apparaît dans une liste d'exposants, mais votre valeur n'est pas toujours visible avant le salon.
                  </p>
                </div>
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Le trafic dans les allées reste imprévisible :</strong> Même avec un bon stand, vous dépendez du passage, du timing et de la curiosité des visiteurs.
                  </p>
                </div>
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Vos temps forts sont découverts trop tard :</strong> Démonstration, lancement produit, offre spéciale, expertise métier : si les visiteurs l'apprennent sur place, beaucoup ne passeront jamais.
                  </p>
                </div>
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Le retour commercial est difficile à préparer :</strong> Sans signaux d'intérêt avant le salon, vos équipes arrivent souvent sans priorités claires.
                  </p>
                </div>
              </div>
            </div>

            {/* Solution */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-primary/20">
                <Check className="h-5 w-5 text-foreground" />
                <span className="text-sm font-semibold text-primary">La solution Lotexpo</span>
              </div>
              
              <h2 className="section-rule heading-display text-3xl text-foreground leading-tight">
                Créez une intention de visite avant le salon
              </h2>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Avant le salon :</strong> Vos nouveautés sont visibles quand les visiteurs préparent leur parcours.
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Pendant le salon :</strong> Les visiteurs savent déjà pourquoi passer sur votre stand.
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Après le salon :</strong> Vous mesurez les signaux d'intérêt générés par vos publications.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-semibold text-foreground">
                  ✨ Résultat : votre présence n'est plus seulement passive. Vous donnez aux visiteurs une raison claire de vous intégrer à leur parcours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section soulagement émotionnel — Ce que vous n'avez plus à laisser au hasard */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
            <h2 className="heading-display text-3xl md:text-4xl text-foreground mb-4 section-rule [&::before]:mx-auto">
              Ce que vous n'avez plus à laisser au hasard
            </h2>
            <p className="text-lg text-muted-foreground">
              Publier une Nouveauté ne sert pas seulement à être visible. Cela permet de réduire l'incertitude avant le salon en donnant aux visiteurs une raison claire d'intégrer votre stand à leur parcours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Être découvert avant le jour J
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Votre nouveauté est visible quand les visiteurs préparent leur parcours, pas seulement quand ils passent devant votre stand.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Donner une vraie raison de passer vous voir
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Produit, démonstration, lancement, offre, conférence : vous montrez à l'avance ce qui mérite le détour.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Parler aux visiteurs déjà intéressés par le salon
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lotexpo ne pousse pas votre message à une audience froide. Vous touchez des professionnels qui cherchent ce salon, ce secteur ou préparent leur visite.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Arriver avec moins d'incertitude
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vous ne misez plus uniquement sur votre emplacement, le trafic dans l'allée ou la chance. Vous créez un signal clair avant l'ouverture.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* How It Works Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <h2 className="heading-display text-3xl md:text-4xl text-center text-foreground mb-4 section-rule [&::before]:mx-auto">
            Comment ça marche ?
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-16 max-w-3xl mx-auto">
            3 étapes simples pour donner plus de visibilité à ce que vous présentez sur votre stand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30" style={{ width: 'calc(100% - 8rem)', margin: '0 4rem' }} />
            
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-center relative z-10 hover:border-primary/40 transition-colors">
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Search className="h-10 w-10 text-foreground-foreground" />
                </div>
                <div className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1 rounded-full mb-4">
                  ÉTAPE 1
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Retrouvez votre salon
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Identifiez l'événement auquel votre entreprise participe et accédez à votre espace exposant.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-center relative z-10 hover:border-primary/40 transition-colors">
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Megaphone className="h-10 w-10 text-foreground-foreground" />
                </div>
                <div className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1 rounded-full mb-4">
                  ÉTAPE 2
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Publiez ce qui mérite le détour
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Présentez un produit, une démonstration, une innovation, un service, une offre ou un temps fort prévu sur votre stand.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-center relative z-10 hover:border-primary/40 transition-colors">
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <LineChart className="h-10 w-10 text-foreground-foreground" />
                </div>
                <div className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1 rounded-full mb-4">
                  ÉTAPE 3
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Transformez l'attention en visites utiles
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Les visiteurs peuvent repérer votre nouveauté, télécharger une brochure ou demander un rendez-vous avant même le début du salon.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section id="pricing" className="py-20">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="heading-display text-3xl text-foreground mb-3 section-rule [&::before]:mx-auto">
              Commencez gratuitement, amplifiez si le salon est stratégique
            </h2>
            <p className="text-muted-foreground text-lg">
              Publiez une première nouveauté gratuitement. Passez au Premium si vous souhaitez multiplier vos publications, suivre vos performances et exploiter davantage les signaux d'intérêt.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plan Gratuit - Point d'entrée */}
            <Card className="relative border-primary shadow-2xl scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">
                  🚀 Commencez ici
                </Badge>
              </div>
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Plan Gratuit</h3>
                    <p className="text-sm text-muted-foreground">
                      Idéal pour publier une première nouveauté et tester Lotexpo
                    </p>
                  </div>

                  <div>
                    <span className="font-display text-4xl font-semibold tracking-tight">0€</span>
                    <span className="text-muted-foreground ml-2">/ événement</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">1 nouveauté par événement</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">3 premiers contacts générés gratuits</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Sans carte bancaire</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Contacts générés illimités</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Export CSV / Statistiques avancées</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full"
                    onClick={() => navigate('/publier-nouveaute')}
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    Publier ma nouveauté gratuitement
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Plan Premium */}
            {/* Plan Premium - Upgrade */}
            <Card className="relative">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                      Plan Premium
                      <Crown className="h-5 w-5 text-foreground" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Pour amplifier vos résultats et accéder à tout le potentiel de la plateforme
                    </p>
                  </div>

                  <div>
                    <span className="font-display text-4xl font-semibold tracking-tight">99€</span>
                    <span className="text-muted-foreground ml-2">HT / événement</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm"><strong>5 Nouveautés par événement</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm"><strong>Accès complet aux contacts générés</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Export CSV de vos contacts</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Statistiques détaillées</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Badge Premium sur vos nouveautés</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Passer au Premium
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="heading-display text-3xl text-foreground mb-3 section-rule [&::before]:mx-auto">
              Premium s'adapte à votre situation
            </h2>
            <p className="text-muted-foreground text-lg">
              Quel que soit votre profil, utilisez Lotexpo pour mieux préparer votre visibilité avant le salon.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Startup */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Zap className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-xl font-bold">Startup innovante</h3>
                <p className="text-sm text-muted-foreground">
                  Vous avez une vraie nouveauté, mais un petit stand ou une faible notoriété.
                </p>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-primary mb-2">Avec Premium :</p>
                  <p className="text-sm text-muted-foreground">
                    Vous mettez votre innovation en avant avant l'ouverture du salon et vous donnez aux visiteurs une raison concrète de vous identifier dans leur parcours.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* PME établie */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-xl font-bold">PME établie</h3>
                <p className="text-sm text-muted-foreground">
                  Vous participez à plusieurs salons par an et vous voulez mieux préparer vos actions commerciales.
                </p>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-primary mb-2">Avec Premium :</p>
                  <p className="text-sm text-muted-foreground">
                    Vous suivez les performances de vos publications, exploitez les signaux d'intérêt et structurez mieux vos actions avant, pendant et après le salon.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Grande entreprise */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-xl font-bold">Grande entreprise</h3>
                <p className="text-sm text-muted-foreground">
                  Vous avez plusieurs offres, divisions ou nouveautés à présenter sur un même salon.
                </p>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-primary mb-2">Avec Premium :</p>
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez mettre en avant plusieurs temps forts et aider les visiteurs à comprendre rapidement ce qui mérite un passage sur votre stand.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="heading-display text-3xl text-foreground mb-3 section-rule [&::before]:mx-auto">
              Questions fréquentes
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Pourquoi publier une nouveauté avant le salon ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Parce que les visiteurs préparent de plus en plus leur venue en amont. Une nouveauté
                claire leur donne une raison concrète d'ajouter votre stand à leur parcours avant même
                l'ouverture du salon.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Est-ce réservé aux entreprises avec un grand stand ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Non. Lotexpo est justement utile aux exposants qui veulent être repérés au-delà de leur
                emplacement physique, qu'ils aient un petit stand, un grand stand ou une visibilité
                limitée sur le salon.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Que puis-je publier comme nouveauté ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Vous pouvez publier un nouveau produit, une démonstration, une offre spéciale, un
                service, une innovation, un cas client, une conférence, une animation ou tout élément
                qui donne aux visiteurs une raison de venir vous rencontrer.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Le Premium garantit-il des leads ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Non. Le Premium ne garantit pas un volume de contacts. Il augmente votre capacité à
                publier, mesurer et exploiter vos signaux d'intérêt. Les résultats dépendront de votre
                salon, de votre offre, de votre message et de votre audience.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="container max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="heading-display text-3xl md:text-4xl text-foreground section-rule [&::before]:mx-auto">
            Donnez aux visiteurs une raison de venir vous voir
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ne laissez pas votre prochaine participation dépendre uniquement du passage dans les allées. Publiez ce que vous présenterez sur votre stand et donnez aux visiteurs une raison de vous ajouter à leur parcours avant le jour J.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              className="text-lg px-8 gap-2"
              onClick={() => navigate('/publier-nouveaute')}
            >
              <Megaphone className="h-5 w-5" />
              Publier ma première nouveauté
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-lg px-8 gap-2"
              onClick={() => setIsDialogOpen(true)}
            >
              <Crown className="h-5 w-5" />
              Découvrir le Premium
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            1 nouveauté gratuite • Sans carte bancaire • Publication en quelques minutes
          </p>
        </div>
      </section>

      <PremiumLeadDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </MainLayout>
    </>
  );
}
