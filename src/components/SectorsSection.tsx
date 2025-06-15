
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const sectors = [
  {
    name: "Technologie & Innovation",
    count: 156,
    color: "bg-blue-100 text-blue-800",
    examples: ["Informatique", "IA & Robotique", "Télécoms", "Startups"],
    searchParam: "Technologie"
  },
  {
    name: "Industrie & Manufacturing",
    count: 142,
    color: "bg-gray-100 text-gray-800",
    examples: ["Mécanique", "Automobile", "Aéronautique", "Métallurgie"],
    searchParam: "Industrie"
  },
  {
    name: "Santé & Médical",
    count: 98,
    color: "bg-green-100 text-green-800",
    examples: ["Médical", "Pharmaceutique", "Biotechnologies", "E-santé"],
    searchParam: "Santé"
  },
  {
    name: "BTP & Construction",
    count: 87,
    color: "bg-orange-100 text-orange-800",
    examples: ["Bâtiment", "Travaux Publics", "Architecture", "Immobilier"],
    searchParam: "BTP"
  },
  {
    name: "Commerce & Distribution",
    count: 134,
    color: "bg-purple-100 text-purple-800",
    examples: ["Retail", "E-commerce", "Franchise", "Logistique"],
    searchParam: "Commerce"
  },
  {
    name: "Alimentation & Agriculture",
    count: 76,
    color: "bg-green-100 text-green-800",
    examples: ["Agroalimentaire", "Agriculture", "Viticulture", "Bio"],
    searchParam: "Alimentation"
  },
  {
    name: "Énergie & Environnement",
    count: 65,
    color: "bg-emerald-100 text-emerald-800",
    examples: ["Énergies renouvelables", "Environnement", "Développement durable"],
    searchParam: "Énergie"
  },
  {
    name: "Services B2B",
    count: 118,
    color: "bg-indigo-100 text-indigo-800",
    examples: ["Conseil", "Finance", "RH", "Communication"],
    searchParam: "Services"
  }
];

const SectorsSection = () => {
  const navigate = useNavigate();

  // Handler simplifié qui ne fait qu'une navigation atomique
  const handleSectorClick = (searchParam: string) => {
    console.log('SectorsSection: Navigating to sector:', searchParam);
    navigate(`/events?sectors=${encodeURIComponent(searchParam)}`, { replace: false });
  };

  return (
    <section id="secteurs" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Explorez par secteur d'activité
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Plus de 50 secteurs d'activité couverts pour répondre à tous vos besoins de prospection commerciale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sectors.map((sector, index) => (
            <Card 
              key={index} 
              className="hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group border-2 hover:border-accent/20"
              onClick={() => handleSectorClick(sector.searchParam)}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                    {sector.name}
                  </h3>
                  <Badge className={`${sector.color} font-semibold`}>
                    {sector.count}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {sector.examples.map((example, idx) => (
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
          ))}
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
