
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, Calendar, Bell, Filter, Zap } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: "Recherche intelligente",
    description: "Notre IA filtre automatiquement les événements professionnels et écarte les salons grand public pour vous faire gagner du temps."
  },
  {
    icon: MapPin,
    title: "Géolocalisation précise",
    description: "Trouvez facilement les salons près de chez vous ou dans vos zones de prospection avec notre carte interactive."
  },
  {
    icon: Calendar,
    title: "Calendrier unifié",
    description: "Visualisez tous les événements de l'année sur un seul calendrier et planifiez vos déplacements en avance."
  },
  {
    icon: Bell,
    title: "Alertes personnalisées",
    description: "Recevez des notifications pour les nouveaux salons dans vos secteurs d'intérêt et ne manquez aucune opportunité."
  },
  {
    icon: Filter,
    title: "Filtrage avancé",
    description: "Filtrez par secteur, taille du salon, type de visiteurs et bien d'autres critères pour trouver exactement ce que vous cherchez."
  },
  {
    icon: Zap,
    title: "Mise à jour quotidienne",
    description: "Nos données sont actualisées chaque jour depuis plus de 80 sources officielles pour une information toujours fraîche."
  }
];

const FeaturesSection = () => {
  return (
    <section id="fonctionnalites" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Pourquoi choisir SalonsPro ?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Une plateforme conçue spécifiquement pour les professionnels commerciaux qui ont besoin 
            d'information fiable et exhaustive sur les salons B2B en France.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="h-full hover:shadow-lg transition-all duration-300 hover:scale-105 gradient-card border-0"
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
