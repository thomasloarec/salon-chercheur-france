import { Search, Route, TrendingUp, Calendar } from 'lucide-react';

const HowItWorksNew = () => {
  return (
    <section className="bg-secondary py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Fonctionnement de Lotexpo
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Avant, il n'existait pas d'unique plateforme : on passait à côté d'événements clés et il était difficile de savoir si un salon valait le déplacement.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Problem 1 */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-accent/20 rounded-full p-3">
                <Search className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Choisir les bons salons
                </h3>
                <p className="text-muted-foreground">
                  On filtre par secteur et on voit les Nouveautés annoncées par les exposants
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Décision éclairée : on ne joue plus à pile ou face
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Tous les événements B2B regroupés au même endroit
                </p>
              </div>
            </div>
          </div>

          {/* Problem 2 */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-accent/20 rounded-full p-3">
                <Route className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Construire son parcours
                </h3>
                <p className="text-muted-foreground">
                  On met des Nouveautés en favoris pour se créer un chemin de stands simple et efficace
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                  <Route className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Gagnez du temps le jour J avec votre parcours personnalisé
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ne manquez aucune opportunité business importante
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksNew;
