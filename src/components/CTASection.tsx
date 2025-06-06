
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Zap, Shield } from 'lucide-react';

const CTASection = () => {
  return (
    <section className="py-20 gradient-hero text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à révolutionner votre prospection ?
          </h2>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Rejoignez plus de 5 000 commerciaux qui utilisent déjà SalonsPro pour optimiser 
            leur présence sur les salons professionnels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
            <CardContent className="p-6 text-center">
              <Bell className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Alertes instantanées</h3>
              <p className="text-gray-200 text-sm">
                Soyez notifié dès qu'un nouveau salon correspond à vos critères
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
            <CardContent className="p-6 text-center">
              <Zap className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Accès premium</h3>
              <p className="text-gray-200 text-sm">
                Données exclusives et analyses avancées pour optimiser votre ROI
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Support dédié</h3>
              <p className="text-gray-200 text-sm">
                Une équipe d'experts pour vous accompagner dans votre stratégie
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <div className="inline-block bg-white/10 backdrop-blur-sm rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">Commencez gratuitement</h3>
            <p className="text-gray-200 mb-6">
              Accès gratuit pendant 30 jours, puis seulement 29€/mois
            </p>
            <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-white font-semibold px-8">
                Essai gratuit 30 jours
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary">
                Voir la démo
              </Button>
            </div>
            <p className="text-sm text-gray-300 mt-4">
              Aucune carte bancaire requise • Annulable à tout moment
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
