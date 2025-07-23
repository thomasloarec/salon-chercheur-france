
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useSectors } from '@/hooks/useSectors';
import { getSectorConfig, HIDDEN_SECTORS_ON_HOME } from '@/constants/sectors';

const SectorsSection = () => {
  const navigate = useNavigate();
  const { data: sectors = [], isLoading } = useSectors();

  // Filter out hidden sectors for home display
  const displayedSectors = sectors.filter(sector => 
    !HIDDEN_SECTORS_ON_HOME.includes(sector.name)
  );

  const handleSectorClick = (sectorId: string) => {
    // Navigation vers /events avec l'ID du secteur (UUID)
    navigate(`/events?sectors=${encodeURIComponent(sectorId)}`);
  };

  if (isLoading) {
    return (
      <section id="secteurs" className="py-20 bg-white">
        <div className="w-full px-6 mx-auto">
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
      <div className="w-full px-6 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Explorez par secteur d'activité
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {sectors.length} secteurs d'activité couverts pour répondre à tous vos besoins de prospection commerciale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedSectors.map((sector) => {
            const config = getSectorConfig(sector.name);
            
            return (
              <Card 
                key={sector.id} 
                className="hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group border-2 hover:border-accent/20"
                onClick={() => handleSectorClick(sector.id)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                      {sector.name}
                    </h3>
                    <Badge className={`${config.color} font-semibold`}>
                      {sectors.length > 12 ? 'Nouveau' : 'Secteur'}
                    </Badge>
                  </div>
                  
                  <div className="text-gray-600 text-sm">
                    <p>{config.description}</p>
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
