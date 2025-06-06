
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Users, ExternalLink } from 'lucide-react';

const recentEvents = [
  {
    id: 1,
    name: "SEPEM Industries Nord",
    location: "Lille Grand Palais",
    city: "Lille",
    date: "15-17 Mars 2024",
    sector: "Industrie",
    attendees: "12 000",
    exhibitors: "450",
    description: "Le salon de référence pour l'industrie manufacturière du Nord de la France",
    image: "/placeholder.svg",
    urgent: false
  },
  {
    id: 2,
    name: "Vivatech 2024",
    location: "Paris Nord Villepinte",
    city: "Paris",
    date: "22-25 Mai 2024",
    sector: "Tech & Innovation",
    attendees: "150 000",
    exhibitors: "3 000",
    description: "Le plus grand événement startup et tech d'Europe",
    image: "/placeholder.svg",
    urgent: true
  },
  {
    id: 3,
    name: "Batimat",
    location: "Paris Nord Villepinte",
    city: "Paris",
    date: "30 Sep - 3 Oct 2024",
    sector: "BTP",
    attendees: "300 000",
    exhibitors: "2 800",
    description: "Le salon mondial du bâtiment et de la construction",
    image: "/placeholder.svg",
    urgent: false
  },
  {
    id: 4,
    name: "SIAL Paris",
    location: "Paris Nord Villepinte",
    city: "Paris",
    date: "19-23 Oct 2024",
    sector: "Agroalimentaire",
    attendees: "160 000",
    exhibitors: "7 500",
    description: "Le salon mondial de l'alimentation",
    image: "/placeholder.svg",
    urgent: true
  }
];

const RecentEventsSection = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Événements à venir
            </h2>
            <p className="text-xl text-gray-600">
              Découvrez les prochains salons professionnels majeurs en France
            </p>
          </div>
          <Button variant="outline" className="hidden md:flex items-center gap-2">
            Voir tous les événements <ExternalLink size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {recentEvents.map((event) => (
            <Card 
              key={event.id} 
              className="hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group overflow-hidden"
            >
              <div className="relative">
                {event.urgent && (
                  <Badge className="absolute top-4 right-4 z-10 bg-red-500 hover:bg-red-600">
                    Inscription urgente
                  </Badge>
                )}
                <div className="h-48 bg-gradient-to-r from-gray-200 to-gray-300 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>
                  <div className="absolute bottom-4 left-4 z-20 text-white">
                    <Badge className={`mb-2 ${
                      event.sector === 'Tech & Innovation' ? 'bg-blue-600' :
                      event.sector === 'Industrie' ? 'bg-gray-600' :
                      event.sector === 'BTP' ? 'bg-orange-600' :
                      'bg-green-600'
                    }`}>
                      {event.sector}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-primary mb-2 group-hover:text-accent transition-colors">
                  {event.name}
                </h3>
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                  {event.description}
                </p>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar size={16} className="text-accent" />
                    <span className="font-medium">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={16} className="text-accent" />
                    <span>{event.location}, {event.city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users size={16} className="text-accent" />
                    <span>{event.attendees} visiteurs • {event.exhibitors} exposants</span>
                  </div>
                </div>

                <Button className="w-full bg-accent hover:bg-accent/90 group-hover:scale-105 transition-transform">
                  Voir les détails
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 md:hidden">
          <Button variant="outline" className="flex items-center gap-2 mx-auto">
            Voir tous les événements <ExternalLink size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default RecentEventsSection;
