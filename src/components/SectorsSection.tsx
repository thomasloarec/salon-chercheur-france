
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useSectors } from '@/hooks/useSectors';

// Mapping des secteurs avec leurs couleurs et exemples
const sectorMapping: Record<string, {
  color: string;
  examples: string[];
  count: number;
}> = {
  'Technologie': {
    color: "bg-blue-100 text-blue-800",
    examples: ["Informatique", "IA & Robotique", "Télécoms", "Startups"],
    count: 156
  },
  'Industrie': {
    color: "bg-gray-100 text-gray-800",
    examples: ["Mécanique", "Automobile", "Aéronautique", "Métallurgie"],
    count: 142
  },
  'Santé': {
    color: "bg-green-100 text-green-800",
    examples: ["Médical", "Pharmaceutique", "Biotechnologies", "E-santé"],
    count: 98
  },
  'BTP': {
    color: "bg-orange-100 text-orange-800",
    examples: ["Bâtiment", "Travaux Publics", "Architecture", "Immobilier"],
    count: 87
  },
  'Commerce': {
    color: "bg-purple-100 text-purple-800",
    examples: ["Retail", "E-commerce", "Franchise", "Logistique"],
    count: 134
  },
  'Alimentation': {
    color: "bg-green-100 text-green-800",
    examples: ["Agroalimentaire", "Agriculture", "Viticulture", "Bio"],
    count: 76
  },
  'Énergie': {
    color: "bg-emerald-100 text-emerald-800",
    examples: ["Énergies renouvelables", "Environnement", "Développement durable"],
    count: 65
  },
  'Services': {
    color: "bg-indigo-100 text-indigo-800",
    examples: ["Conseil", "Finance", "RH", "Communication"],
    count: 118
  }
};

const SectorsSection = () => {
  const navigate = useNavigate();
  const { data: sectors = [], isLoading } = useSectors();

  const handleSectorClick = (sectorName: string) => {
    // Navigation vers /events avec le nom du secteur en query param
    navigate(`/events?sectors=${encodeURIComponent(sectorName)}`);
  };

  if (isLoading) {
    return (
      <section id="secteurs" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Explorez par secteur d'activité
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Chargement des secteurs...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="secteurs" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Explorez par secteur d'activité
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Plus de {sectors.length} secteurs d'activité couverts pour répondre à tous vos besoins de prospection commerciale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sectors.map((sector) => {
            // Chercher la correspondance dans notre mapping statique
            const matchKey = Object.keys(sectorMapping).find(key => 
              sector.name.toLowerCase().includes(key.toLowerCase())
            );
            const sectorConfig = matchKey ? sectorMapping[matchKey] : {
              color: "bg-blue-100 text-blue-800",
              examples: ["Divers"],
              count: 50
            };

            return (
              <Card 
                key={sector.id} 
                className="hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group border-2 hover:border-accent/20"
                onClick={() => handleSectorClick(sector.name)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                      {sector.name}
                    </h3>
                    <Badge className={`${sectorConfig.color} font-semibold`}>
                      {sectorConfig.count}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {sectorConfig.examples.map((example, idx) => (
                      <span 
                        key={idx} 
                        className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full mr-2 mb-2"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <button 
            className="text-accent font-semibold hover:underline text-lg"
            onClick={() => navigate('/events')}
          >
            Voir tous les secteurs →
          </button>
        </div>
      </div>
    </section>
  );
};

export default SectorsSection;
