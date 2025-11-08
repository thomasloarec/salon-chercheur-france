import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const JoinBlock = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Image/Visual */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/placeholder.svg" 
                alt="Rejoindre Lotexpo"
                className="w-full h-[400px] object-cover"
              />
            </div>
            {/* Optional: Add decorative elements */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
          </div>

          {/* Right: Content */}
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Rejoindre Lotexpo
            </h2>
            
            <p className="text-xl text-muted-foreground mb-8">
              Créez votre compte gratuit pour suivre vos salons, sauvegarder les Nouveautés qui vous intéressent et planifier un parcours de stands efficace le jour J.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="bg-accent/20 rounded-full p-1 mt-1">
                  <Check className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Suivre mes salons
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Ajoutez vos événements favoris et recevez des notifications
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-accent/20 rounded-full p-1 mt-1">
                  <Check className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Favoris Nouveautés
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Sauvegardez les innovations qui vous intéressent
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-accent/20 rounded-full p-1 mt-1">
                  <Check className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Mon parcours
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Planifiez votre visite pour un maximum d'efficacité
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-lg font-semibold px-8 h-14"
            >
              Inscription gratuite
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JoinBlock;
