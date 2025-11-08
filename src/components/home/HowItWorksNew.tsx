import { Search, Sparkles, Users, ArrowRight } from 'lucide-react';

const HowItWorksNew = () => {
  return (
    <section className="bg-secondary py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Remettre l'humain au centre de votre travail
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Les salons professionnels sont le meilleur endroit pour créer des relations business, mais on les délaisse parce qu'ils sont difficiles à préparer. Lotexpo change la donne.
          </p>
        </div>

        {/* 3 steps with arrows */}
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Step 1 */}
            <div className="mb-8">
              <div className="bg-card border-2 border-border rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-4 shrink-0">
                    <Search className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                        Étape 1
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">
                      Connaître toutes les opportunités de salons possibles
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      Tous les événements B2B regroupés au même endroit. Plus de salons inconnus, plus d'opportunités manquées.
                    </p>
                  </div>
                </div>
              </div>
              {/* Arrow down */}
              <div className="flex justify-center my-6">
                <ArrowRight className="h-12 w-12 text-accent rotate-90" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="mb-8">
              <div className="bg-card border-2 border-border rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-full p-4 shrink-0">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                        Étape 2
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">
                      Faire son choix avec un maximum d'informations
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      Filtrez par secteur et découvrez les Nouveautés annoncées par les exposants. Décision éclairée, on ne joue plus à pile ou face.
                    </p>
                  </div>
                </div>
              </div>
              {/* Arrow down */}
              <div className="flex justify-center my-6">
                <ArrowRight className="h-12 w-12 text-accent rotate-90" />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="bg-gradient-to-br from-accent to-accent/80 rounded-full p-4 shrink-0">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-bold text-accent bg-accent/20 px-3 py-1 rounded-full">
                        Étape 3
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">
                      Rencontrer les gens qui comptent pour votre business
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      Mettez des Nouveautés en favoris, construisez votre parcours de stands. Le salon professionnel redevient un élément charnière de votre business.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksNew;
