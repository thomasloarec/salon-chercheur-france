import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, TrendingUp, Users, Calendar, X, BarChart3, Search, Megaphone, LineChart, Quote } from 'lucide-react';
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
    <MainLayout title="Lotexpo pour les Exposants - Maximisez votre ROI événementiel">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 border-b">
        <div className="container max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            {/* Badge social proof */}
            <Badge variant="secondary" className="text-sm">
              🎯 Déjà adopté par 127 exposants professionnels
            </Badge>

            {/* Headline - Bénéfice principal */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Ne laissez plus votre{' '}
              <span className="text-primary">emplacement</span>
              <br />
              décider de votre succès
            </h1>

            {/* Sous-titre - Promesse */}
            <p className="text-xl text-muted-foreground leading-relaxed">
              Arrivez au salon avec <strong className="text-foreground">votre planning déjà rempli</strong>.
              <br />
              Transformez vos innovations en rendez-vous qualifiés 
              <strong className="text-foreground"> avant l'ouverture des portes</strong>.
            </p>

            {/* CTA principal */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8 gap-2 shadow-lg"
                onClick={() => setIsDialogOpen(true)}
              >
                <Zap className="h-5 w-5" />
                Passer au Premium - 99€
              </Button>
            </div>

            {/* Trust indicators */}
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600" />
                Sans engagement
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600" />
                Activation immédiate
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600" />
                Paiement sécurisé
              </span>
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
              
              <h2 className="text-3xl font-bold leading-tight">
                Pourquoi 80% des exposants repartent des salons déçus ?
              </h2>

              <div className="space-y-4">
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Mauvais emplacement :</strong> Votre stand est mal placé, peu visible
                  </p>
                </div>
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Trafic aléatoire :</strong> Les visiteurs passent devant sans s'arrêter
                  </p>
                </div>
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">ROI incertain :</strong> Impossible de prévoir le retour sur les 30k€ investis
                  </p>
                </div>
                <div className="p-4 bg-background border border-border rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Équipe démotivée :</strong> Vos commerciaux attendent des visiteurs qui ne viennent pas
                  </p>
                </div>
              </div>
            </div>

            {/* Solution */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">La solution Premium</span>
              </div>
              
              <h2 className="text-3xl font-bold leading-tight">
                Créez votre propre trafic qualifié
              </h2>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Visibilité maximale :</strong> Vos nouveautés sont visibles par tous les futurs visiteurs du salon.
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Leads qualifiés :</strong> Collectez contacts et RDV avant l'ouverture
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <strong className="text-foreground">Planning pré-rempli :</strong> Arrivez avec vos rendez-vous déjà planifiés
                  </p>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-green-50 to-primary/5 dark:from-green-950 dark:to-primary/10 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ✨ Résultat : Salon rentabilisé dès le premier jour, équipe motivée, budget optimisé.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section - Pourquoi publier vos nouveautés */}
      <section className="bg-background py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-foreground mb-16">
            Pourquoi publier vos nouveautés sur Lotexpo ?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <div className="bg-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Visibilité pré-événement
              </h3>
              <p className="text-muted-foreground">
                Les visiteurs découvrent vos innovations avant le salon et planifient de vous rendre visite
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <div className="bg-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Leads qualifiés
              </h3>
              <p className="text-muted-foreground">
                Collectez les coordonnées de prospects réellement intéressés par vos produits
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <div className="bg-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                ROI mesuré
              </h3>
              <p className="text-muted-foreground">
                Suivez les performances de vos nouveautés avec des statistiques détaillées
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-foreground mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-16 max-w-3xl mx-auto">
            3 étapes simples pour transformer votre participation en succès mesurable
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-accent/50 via-primary/50 to-accent/50" style={{ width: 'calc(100% - 8rem)', margin: '0 4rem' }} />
            
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-card border-2 border-accent/20 rounded-2xl p-8 text-center relative z-10 hover:border-accent/40 transition-colors">
                <div className="bg-gradient-to-br from-accent to-primary rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Search className="h-10 w-10 text-white" />
                </div>
                <div className="inline-block bg-accent/10 text-accent font-bold text-sm px-4 py-1 rounded-full mb-4">
                  ÉTAPE 1
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Trouvez votre salon
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Identifiez le salon professionnel auquel votre société participe prochainement sur notre plateforme.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-center relative z-10 hover:border-primary/40 transition-colors">
                <div className="bg-gradient-to-br from-primary to-accent rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Megaphone className="h-10 w-10 text-white" />
                </div>
                <div className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1 rounded-full mb-4">
                  ÉTAPE 2
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Publiez votre nouveauté
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Démarquez-vous ! Annoncez un nouveau produit, un partenariat, une démonstration exclusive, une offre spéciale... Soyez remarquable pour attirer des visiteurs sur votre stand.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-card border-2 border-accent/20 rounded-2xl p-8 text-center relative z-10 hover:border-accent/40 transition-colors">
                <div className="bg-gradient-to-br from-accent to-primary rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <LineChart className="h-10 w-10 text-white" />
                </div>
                <div className="inline-block bg-accent/10 text-accent font-bold text-sm px-4 py-1 rounded-full mb-4">
                  ÉTAPE 3
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Générez des leads avant J-0
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Collectez des rendez-vous et téléchargements de brochures <strong>avant l'ouverture</strong>. 
                  Vous capitalisez déjà du ROI avant même le début du salon. 
                  Essentiel quand la participation coûte des dizaines de milliers d'euros.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section className="py-20">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">
              Choisissez votre niveau d'impact
            </h2>
            <p className="text-muted-foreground text-lg">
              Un seul événement bien préparé peut générer des mois de pipeline commercial
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plan Gratuit */}
            <Card className="relative">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Plan Gratuit</h3>
                    <p className="text-sm text-muted-foreground">
                      Pour tester la plateforme
                    </p>
                  </div>

                  <div>
                    <span className="text-4xl font-bold">0€</span>
                    <span className="text-muted-foreground ml-2">/ événement</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">1 nouveauté par événement</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">3 premiers leads gratuits</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Leads illimités</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Export CSV</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Statistiques avancées</span>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    Plan actuel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Plan Premium */}
            <Card className="relative border-primary shadow-2xl scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">
                  ⭐ Recommandé
                </Badge>
              </div>

              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                      Plan Premium
                      <Crown className="h-5 w-5 text-primary" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Pour maximiser votre ROI
                    </p>
                  </div>

                  <div>
                    <span className="text-4xl font-bold">99€</span>
                    <span className="text-muted-foreground ml-2">HT / événement</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm"><strong>Nouveautés illimitées</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm"><strong>Leads illimités</strong> - Collectez tous les contacts</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Export CSV de vos leads</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Statistiques détaillées en temps réel</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Badge Premium sur vos nouveautés</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90"
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
            <h2 className="text-3xl font-bold mb-3">
              Premium s'adapte à votre situation
            </h2>
            <p className="text-muted-foreground text-lg">
              Quel que soit votre profil, maximisez votre impact
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Startup */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Startup innovante</h3>
                <p className="text-sm text-muted-foreground">
                  Vous lancez un produit révolutionnaire mais avez un petit stand en fond de hall.
                </p>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-primary mb-2">Résultat avec Premium :</p>
                  <p className="text-sm text-muted-foreground">
                    Votre innovation apparaît en première page, génère 50+ leads qualifiés, 
                    et vous repartez avec un pipeline commercial de 6 mois.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* PME établie */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">PME établie</h3>
                <p className="text-sm text-muted-foreground">
                  Vous participez à plusieurs salons par an et devez justifier chaque investissement.
                </p>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-primary mb-2">Résultat avec Premium :</p>
                  <p className="text-sm text-muted-foreground">
                    ROI mesuré dès J-7, planning pré-rempli, export direct vers votre CRM. 
                    Vous optimisez votre budget événementiel avec des données concrètes.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Grande entreprise */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Grande entreprise</h3>
                <p className="text-sm text-muted-foreground">
                  Vous avez un grand stand mais noyé dans la masse d'exposants similaires.
                </p>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-primary mb-2">Résultat avec Premium :</p>
                  <p className="text-sm text-muted-foreground">
                    Créez le buzz avec plusieurs nouveautés Premium, segmentez vos audiences, 
                    et générez un trafic ciblé vers votre stand.
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
            <h2 className="text-3xl font-bold mb-3">
              Questions fréquentes
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Comment fonctionne le Premium ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Le Premium débloque toutes les fonctionnalités pour un événement spécifique. 
                Vous pouvez publier jusqu'à 5 nouveautés, collecter tous les leads 
                sans limitation, et exporter vos données au format CSV pour les intégrer à votre CRM.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Le paiement est-il par mois ou par événement ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Le Premium est facturé par événement (99€ HT). Cela signifie que vous payez une fois 
                pour obtenir tous les avantages Premium sur un salon spécifique. Si vous participez à 
                plusieurs salons, vous pouvez activer le Premium sur chacun d'entre eux indépendamment.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Puis-je annuler à tout moment ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Le Premium étant lié à un événement spécifique et non à un abonnement, 
                il n'y a pas de renouvellement automatique. Vous gardez l'accès Premium jusqu'à 
                la fin de l'événement concerné. Il n'y a donc rien à annuler.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Combien de leads puis-je espérer ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Le nombre de leads dépend de plusieurs facteurs : la qualité de vos nouveautés, 
                l'attractivité de votre offre, et la taille de l'événement. Nos exposants Premium 
                génèrent un traffic lors du salon et un nombre de leads toujours plus élevés que 
                les exposants qui n'utilisent pas Lotexpo.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="container max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Prêt à maximiser votre ROI salon ?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Rejoignez les exposants qui capitalisent leur participation 
            avant même l'ouverture des portes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              className="text-lg px-8 gap-2"
              onClick={() => setIsDialogOpen(true)}
            >
              <Zap className="h-5 w-5" />
              Passer au Premium - 99€
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-lg px-8"
              onClick={() => navigate('/events')}
            >
              Voir les événements
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Sans engagement • Activation immédiate • Paiement sécurisé
          </p>
        </div>
      </section>

      <PremiumLeadDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </MainLayout>
  );
}
