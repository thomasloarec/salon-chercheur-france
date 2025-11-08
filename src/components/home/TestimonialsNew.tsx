import { Quote } from 'lucide-react';

const TestimonialsNew = () => {
  const testimonials = [
    {
      quote: "Je fais de la prospection sur les salons. Avec Lotexpo, je ne passe plus à côté des bons événements — je cible ceux qui créent vraiment des opportunités.",
      name: "Marc D.",
      role: "Commercial",
      image: "/placeholder.svg"
    },
    {
      quote: "Je prépare ma veille à l'avance : je repère les nouveautés qui m'intéressent et je sais exactement quels stands voir en priorité.",
      name: "Sophie L.",
      role: "Responsable Marketing & Veille",
      image: "/placeholder.svg"
    },
    {
      quote: "Je dois trouver des fournisseurs fiables rapidement. Les Nouveautés me montrent qui apporte vraiment de la valeur — je planifie un parcours efficace en 30 minutes.",
      name: "Thomas R.",
      role: "Acheteur / Sourcing",
      image: "/placeholder.svg"
    }
  ];

  return (
    <section className="bg-background py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Ils utilisent Lotexpo
          </h2>
          <p className="text-xl text-muted-foreground">
            Des professionnels comme vous font confiance à Lotexpo
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-8 relative"
            >
              <Quote className="h-12 w-12 text-accent/20 absolute top-6 right-6" />
              
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-muted overflow-hidden mb-4">
                  <img 
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <p className="text-foreground text-lg italic leading-relaxed mb-4">
                  "{testimonial.quote}"
                </p>
              </div>

              <div>
                <p className="font-semibold text-foreground">
                  {testimonial.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {testimonial.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsNew;
