import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, TrendingUp, Users, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MainLayout from '@/components/layout/MainLayout';
import { useToast } from '@/hooks/use-toast';

export default function Premium() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    position: ''
  });

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleSubmitActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    try {
      // Simulation d'envoi - à remplacer par un vrai appel API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: '✅ Merci !',
        description: 'Votre demande d\'accès Premium a bien été transmise. Un membre de notre équipe vous contactera rapidement pour confirmer l\'activation et répondre à vos questions.',
        duration: 6000,
      });
      
      setIsDialogOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        position: ''
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer la demande. Réessayez.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <MainLayout title="Premium - Maximisez votre ROI événementiel">
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
                onClick={handleOpenDialog}
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
                <span className="text-destructive font-semibold text-sm">Le problème</span>
              </div>
              <h2 className="text-3xl font-bold">
                Un stand mal placé =<br />un salon raté
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="text-destructive text-xl">❌</span>
                  <p>
                    <strong className="text-foreground">Hall éloigné ?</strong> Les visiteurs ne passeront jamais devant votre stand
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-destructive text-xl">❌</span>
                  <p>
                    <strong className="text-foreground">Budget marketing limité ?</strong> Impossible de rivaliser avec les grands comptes
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-destructive text-xl">❌</span>
                  <p>
                    <strong className="text-foreground">Équipe commerciale en attente ?</strong> Des heures perdues à espérer des visiteurs
                  </p>
                </div>
              </div>
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-semibold text-destructive">
                  Résultat : ROI négatif, moral en berne, budget gâché.
                </p>
              </div>
            </div>

            {/* Solution */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <Crown className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400 font-semibold text-sm">La solution Premium</span>
              </div>
              <h2 className="text-3xl font-bold">
                Vos innovations au<br />premier plan
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <p>
                    <strong className="text-foreground">Visibilité maximale :</strong> Jusqu'à 5 nouveautés mises en avant sur l'événement
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <p>
                    <strong className="text-foreground">Leads qualifiés :</strong> Coordonnées complètes des visiteurs intéressés
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <p>
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
                    <span className="text-5xl font-bold text-primary">99€</span>
                    <span className="text-muted-foreground ml-2">HT / nouveauté</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Par nouveauté et par événement
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 font-bold" />
                      <span className="text-sm font-medium">
                        <strong>5 nouveautés</strong> par événement
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 font-bold" />
                      <span className="text-sm font-medium">
                        <strong>Leads illimités</strong> avec coordonnées complètes
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 font-bold" />
                      <span className="text-sm font-medium">
                        <strong>Export CSV</strong> (Salesforce, HubSpot, Pipedrive)
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 font-bold" />
                      <span className="text-sm font-medium">
                        <strong>Statistiques</strong> temps réel (vues, likes, conversions)
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 font-bold" />
                      <span className="text-sm font-medium">
                        <strong>Badge "Premium"</strong> sur vos nouveautés
                      </span>
                    </div>
                  </div>

                  <Button 
                    className="w-full text-lg h-12 shadow-lg gap-2"
                    onClick={handleOpenDialog}
                  >
                    <Zap className="h-5 w-5" />
                    Activer maintenant
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Paiement unique par événement • Sans abonnement
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Garantie */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-full">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-green-900 dark:text-green-100 text-sm">
                  Garantie résultats
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Si vous n'obtenez aucun lead, nous vous remboursons
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-muted/50 border-y">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">
              Pourquoi le Premium s'adapte à chaque type d'exposant
            </h2>
            <p className="text-muted-foreground">
              Des besoins différents, une même logique : rentabiliser sa présence sur chaque salon.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Use case 1 */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-bold text-lg">Startup en croissance</h3>
                <p className="text-sm text-muted-foreground">
                  Vous lancez vos premiers produits ou cherchez vos premiers clients B2B ? Le Premium vous aide à maximiser votre visibilité sur le salon et à capter des leads qualifiés avant même l'ouverture des portes.
                </p>
              </CardContent>
            </Card>

            {/* Use case 2 */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-bold text-lg">PME établie</h3>
                <p className="text-sm text-muted-foreground">
                  Vous exposez régulièrement et souhaitez renforcer le retour sur investissement de vos salons ? Avec le Premium, vos nouveautés sont mises en avant et vous pouvez exploiter l'intégralité de vos leads sans limite.
                </p>
              </CardContent>
            </Card>

            {/* Use case 3 */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg">Grand compte</h3>
                <p className="text-sm text-muted-foreground">
                  Vous gérez plusieurs lancements produits ou participez à de nombreux salons dans l'année ? Le Premium vous permet de centraliser vos leads, de piloter vos actions commerciales et d'optimiser votre présence sur chaque événement.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="container max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Questions fréquentes
          </h2>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold">
                Comment ça marche concrètement ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-3">Le Premium se facture par nouveauté et par événement :</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Vous cliquez sur "Activer le Premium" et remplissez le formulaire</li>
                  <li>Notre équipe valide votre demande sous 24h et vous envoie un lien de paiement sécurisé</li>
                  <li>Une fois le paiement effectué (99€ HT), votre nouveauté bénéficie de tous les avantages Premium</li>
                  <li>Pas d'abonnement, pas de reconduction automatique</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold">
                Puis-je annuler après paiement ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">
                  <strong className="text-foreground">Non, le paiement est définitif</strong> car il active immédiatement les fonctionnalités Premium pour votre nouveauté.
                </p>
                <p>
                  Cependant, si vous n'obtenez <strong>aucun lead</strong> pendant toute la durée de l'événement, nous vous remboursons intégralement sous 7 jours après la fin du salon.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold">
                Quand suis-je facturé ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">
                  La facturation intervient <strong className="text-foreground">après validation de votre demande</strong> par notre équipe et réception du lien de paiement sécurisé.
                </p>
                <p>
                  Vos fonctionnalités Premium sont activées dès réception du paiement, généralement sous 2 heures.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold">
                Combien de leads vais-je générer ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">
                  Cela dépend de nombreux facteurs : attractivité de votre innovation, taille de l'événement, qualité de votre présentation...
                </p>
                <p className="mb-2">
                  <strong className="text-foreground">Moyenne constatée :</strong> Entre 15 et 50 leads qualifiés par nouveauté Premium sur un salon de taille moyenne (5000+ visiteurs).
                </p>
                <p className="text-sm">
                  💡 Astuce : Plus vous publiez tôt (J-60), plus vous générez de leads.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container max-w-4xl mx-auto px-4 text-center space-y-8">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            🎯 Offre de lancement
          </Badge>

          <h2 className="text-4xl md:text-5xl font-bold">
            Prêt à remplir votre planning<br />avant l'ouverture des portes ?
          </h2>

          <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Rejoignez les <strong>127 exposants</strong> qui génèrent déjà leurs leads<br />
            avec LotExpo Premium
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8 h-14 gap-2 shadow-2xl"
              onClick={handleOpenDialog}
            >
              <Zap className="h-5 w-5" />
              Activer le Premium - 99€
            </Button>
          </div>

          <p className="text-sm text-primary-foreground/80">
            ✓ Activation sous 2h • ✓ Paiement sécurisé • ✓ Garantie résultats
          </p>
        </div>
      </section>

      {/* Dialog Activation Premium */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Demande d'accès Premium</DialogTitle>
          <DialogDescription>
            Remplissez vos informations pour être recontacté(e) par notre équipe et finaliser l'activation de votre offre Premium sur cet événement.
          </DialogDescription>
        </DialogHeader>
          
          <form onSubmit={handleSubmitActivation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jean"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Dupont"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email professionnel *</Label>
              <Input
                id="email"
                type="email"
                placeholder="jean.dupont@entreprise.fr"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone professionnel *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Entreprise *</Label>
              <Input
                id="company"
                type="text"
                placeholder="Nom de votre entreprise"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Poste *</Label>
              <Input
                id="position"
                type="text"
                placeholder="Responsable Marketing"
                required
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full gap-2"
              disabled={sending}
            >
              {sending ? (
                <>Envoi en cours...</>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Envoyer ma demande Premium
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
