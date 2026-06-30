import { Search, Sparkles, Users, ArrowRight } from 'lucide-react';

const HowItWorksNew = () => {
  return (
    <section className="bg-secondary py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="section-rule [&::before]:mx-auto heading-display text-4xl md:text-5xl text-foreground mb-6">
            Les salons concentrent l'attention. Lotexpo la transforme en rencontres utiles.
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Un salon professionnel ne crée de la valeur que si vous savez pourquoi vous y allez, qui vous voulez rencontrer et ce que vous voulez découvrir. Lotexpo vous aide à passer d'une liste d'événements à un vrai plan d'action.
          </p>
        </div>

        {/* 3 steps with arrows */}
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Step 1 */}
            <div className="mb-8">
              <div className="bg-card border-2 border-border rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="bg-primary rounded-full p-4 shrink-0">
                    <Search className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        Étape 1
                      </span>
                    </div>
                    <h3 className="heading-display text-2xl text-foreground mb-3">
                      Identifier les salons qui méritent votre déplacement
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      Tous les événements B2B sont regroupés au même endroit pour éviter les salons oubliés et les opportunités manquées.
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
                  <div className="bg-primary rounded-full p-4 shrink-0">
                    <Sparkles className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        Étape 2
                      </span>
                    </div>
                    <h3 className="heading-display text-2xl text-foreground mb-3">
                      Repérer les exposants et nouveautés à suivre
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      Découvrez les informations utiles avant le jour J pour savoir quels stands peuvent réellement vous intéresser.
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
                    <Users className="h-8 w-8 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-bold text-accent bg-accent/20 px-3 py-1 rounded-full">
                        Étape 3
                      </span>
                    </div>
                    <h3 className="heading-display text-2xl text-foreground mb-3">
                      Transformer votre visite en rencontres business
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      Sauvegardez les nouveautés, préparez votre parcours et concentrez votre temps sur les contacts qui comptent.
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
