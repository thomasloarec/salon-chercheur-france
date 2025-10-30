import { FileText, Eye, Calendar, Send, TrendingUp, Users } from 'lucide-react';

const HowItWorks = () => {
  const exhibitorSteps = [
    {
      icon: FileText,
      title: 'Publiez votre Nouveauté',
      description: 'Annoncez vos lancements, démos et offres salon en quelques clics.'
    },
    {
      icon: TrendingUp,
      title: 'Soyez mis en avant',
      description: 'Votre nouveauté apparaît dans les recherches ciblées par secteur et date.'
    },
    {
      icon: Users,
      title: 'Recevez des leads & RDV',
      description: 'Collectez téléchargements et rendez-vous avant même l\'ouverture du salon.'
    }
  ];

  const visitorSteps = [
    {
      icon: Eye,
      title: 'Découvrez les nouveautés',
      description: 'Filtrez par secteur, mois et région pour voir ce qui vous intéresse.'
    },
    {
      icon: Send,
      title: 'Interagissez',
      description: 'Likez, commentez et téléchargez les brochures qui vous parlent.'
    },
    {
      icon: Calendar,
      title: 'Planifiez vos visites',
      description: 'Réservez des RDV ciblés sur les stands avant le jour J.'
    }
  ];

  return (
    <section className="bg-[#0B0F19] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-[#E6EAF3] mb-16">
          Comment ça marche ?
        </h2>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Exposants */}
          <div>
            <h3 className="text-2xl font-semibold text-[#FF7A00] mb-8 text-center md:text-left">
              Pour les Exposants
            </h3>
            <div className="space-y-8">
              {exhibitorSteps.map((step, index) => (
                <div 
                  key={index}
                  className="flex gap-4 items-start bg-[#0F1424]/60 backdrop-blur-xl rounded-xl p-6 border border-white/10 hover:border-[#FF7A00]/50 transition-all duration-300"
                >
                  <div className="bg-[#FF7A00]/10 rounded-lg p-3 flex-shrink-0">
                    <step.icon className="h-6 w-6 text-[#FF7A00]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-[#E6EAF3] mb-2">
                      {index + 1}. {step.title}
                    </h4>
                    <p className="text-[#E6EAF3]/70 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visiteurs */}
          <div>
            <h3 className="text-2xl font-semibold text-[#5B9DFF] mb-8 text-center md:text-left">
              Pour les Visiteurs
            </h3>
            <div className="space-y-8">
              {visitorSteps.map((step, index) => (
                <div 
                  key={index}
                  className="flex gap-4 items-start bg-[#0F1424]/60 backdrop-blur-xl rounded-xl p-6 border border-white/10 hover:border-[#5B9DFF]/50 transition-all duration-300"
                >
                  <div className="bg-[#5B9DFF]/10 rounded-lg p-3 flex-shrink-0">
                    <step.icon className="h-6 w-6 text-[#5B9DFF]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-[#E6EAF3] mb-2">
                      {index + 1}. {step.title}
                    </h4>
                    <p className="text-[#E6EAF3]/70 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
