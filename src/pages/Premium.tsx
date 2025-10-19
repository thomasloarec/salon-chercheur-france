import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, Mail, Download, TrendingUp, Users, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Premium() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = React.useState(false);

  const handleContactSales = async () => {
    setSending(true);
    try {
      toast({
        title: 'Demande enregistrée',
        description: 'Notre équipe vous contactera sous 24h pour activer votre accès Premium.',
        duration: 5000,
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Badge className="mb-4 bg-gradient-to-r from-primary to-primary/80 text-white border-0">
          <Crown className="h-3 w-3 mr-1" />
          Offre Premium
        </Badge>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Multipliez vos opportunités commerciales
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Publiez plus de nouveautés, captez plus de leads qualifiés et boostez votre ROI événementiel
        </p>
      </section>

      {/* Pricing Comparison */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Plan Gratuit */}
          <Card className="relative border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Plan Gratuit</CardTitle>
              <CardDescription>Pour tester la plateforme</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">0€</span>
                <span className="text-muted-foreground ml-2">/ événement</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm">1 nouveauté par événement</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm">3 premiers leads gratuits</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">Leads illimités</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">Export CSV</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">Statistiques avancées</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Premium */}
          <Card className="relative border-2 border-primary shadow-xl">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-1">
                <Crown className="h-3 w-3 mr-1" />
                Recommandé
              </Badge>
            </div>
            
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                Plan Premium
                <Zap className="h-6 w-6 text-primary" />
              </CardTitle>
              <CardDescription>Pour maximiser votre impact</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">99€</span>
                <span className="text-muted-foreground ml-2">HT / nouveauté</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Par nouveauté et par événement
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">5 nouveautés par événement</p>
                    <p className="text-xs text-muted-foreground">Multipliez votre visibilité</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Leads illimités</p>
                    <p className="text-xs text-muted-foreground">Aucune limite de contacts</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Coordonnées complètes</p>
                    <p className="text-xs text-muted-foreground">Email, téléphone, entreprise, fonction</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Export CSV</p>
                    <p className="text-xs text-muted-foreground">Import direct dans votre CRM</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Statistiques détaillées</p>
                    <p className="text-xs text-muted-foreground">Performance en temps réel</p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full mt-6" 
                size="lg"
                onClick={handleContactSales}
                disabled={sending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {sending ? 'Envoi...' : 'Être recontacté'}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Réponse sous 24h
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Detailed Features */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <h2 className="text-3xl font-bold text-center mb-12">
          Pourquoi passer au Premium ?
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Leads illimités</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Accédez à tous les contacts intéressés par vos nouveautés sans restriction. 
                Maximisez votre pipeline commercial.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Export CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Téléchargez vos leads en un clic et importez-les directement dans votre CRM 
                (Salesforce, HubSpot, Pipedrive, etc.)
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Analytics avancés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Suivez les performances de vos nouveautés en temps réel : vues, likes, 
                leads générés, taux de conversion.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ROI Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 md:p-12 border border-primary/20">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Calculez votre ROI
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">99€</div>
              <div className="text-sm text-muted-foreground">Investissement par nouveauté</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">50+</div>
              <div className="text-sm text-muted-foreground">Leads qualifiés en moyenne</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">&lt;2€</div>
              <div className="text-sm text-muted-foreground">Coût par lead qualifié</div>
            </div>
          </div>

          <p className="text-center text-muted-foreground mb-8">
            Comparé aux coûts d'acquisition traditionnels (Google Ads, salons, cold calling), 
            le plan Premium offre un ROI exceptionnel pour vos nouveautés.
          </p>

          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={handleContactSales}
              disabled={sending}
              className="gap-2"
            >
              Passer au Premium
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <h2 className="text-3xl font-bold text-center mb-12">
          Questions fréquentes
        </h2>

        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comment ça marche ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Le plan Premium est facturé par nouveauté et par événement. Une fois activé, 
                vous pouvez publier jusqu'à 5 nouveautés par événement et accéder à tous les leads illimités.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Puis-je changer d'avis ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Oui, le plan Premium est sans engagement. Vous pouvez l'activer pour un événement spécifique 
                et revenir au plan gratuit quand vous le souhaitez.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quand suis-je facturé ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                La facturation intervient après validation de votre demande par notre équipe. 
                Vous recevrez une facture par email avant activation du plan Premium.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">
          Prêt à booster vos résultats ?
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Rejoignez les exposants qui génèrent 10x plus de leads grâce au plan Premium
        </p>
        <Button 
          size="lg"
          onClick={handleContactSales}
          disabled={sending}
          className="gap-2"
        >
          <Mail className="h-5 w-5" />
          Être recontacté par notre équipe
        </Button>
      </section>
    </div>
  );
}
