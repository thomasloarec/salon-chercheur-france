import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const HomeFaq = () => {
  const faqs = [
    {
      question: 'En quoi est-ce différent de LinkedIn/Twitter ?',
      answer: 'Sur les réseaux sociaux, l\'information se perd dans le flux. Sur LotExpo, tout est centré sur ce qui sera montré en salon : nouveautés triées par secteur, salon et date, avec possibilité de réserver des RDV et télécharger des brochures — le tout au même endroit. Vous ne passez plus à côté des annonces importantes pour votre activité.'
    },
    {
      question: 'Qui peut publier une Nouveauté ?',
      answer: 'Tout exposant inscrit à un salon professionnel peut publier des nouveautés. Il suffit de créer un compte gratuit et de renseigner votre participation à un événement. Vous pouvez publier jusqu\'à 3 nouveautés gratuitement par salon, puis passer en Premium pour publier et recevoir des leads en illimité.'
    },
    {
      question: 'Comment fonctionnent les leads ?',
      answer: 'Chaque téléchargement de brochure ou demande de RDV génère un lead que vous pouvez consulter dans votre tableau de bord. En version gratuite, vous recevez jusqu\'à 3 leads par salon (les coordonnées des 3 premiers contacts). Au-delà, passez en Premium (99€ HT/salon) pour recevoir tous les leads sans limitation.'
    },
    {
      question: 'Faut-il créer un compte pour consulter les nouveautés ?',
      answer: 'Non, vous pouvez consulter librement toutes les nouveautés sans créer de compte. Un compte est nécessaire uniquement pour interagir : liker, commenter, télécharger des brochures ou réserver des RDV avec les exposants.'
    },
    {
      question: 'Quelles données sont publiques ?',
      answer: 'Les nouveautés publiées (titre, description, images, nom de l\'exposant, salon concerné) sont visibles par tous les visiteurs. En revanche, vos informations personnelles (email, téléphone) ne sont jamais rendues publiques et sont uniquement partagées avec les exposants lorsque vous demandez un RDV ou téléchargez une brochure.'
    },
    {
      question: 'Puis-je annuler mon abonnement Premium ?',
      answer: 'L\'abonnement Premium est facturé par salon, sans engagement. Si vous ne souhaitez plus être Premium pour un événement futur, il suffit de ne pas renouveler. Vous conservez l\'accès Premium et vos leads pour les salons déjà payés.'
    }
  ];

  return (
    <section className="bg-[#0F1424] py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-[#E6EAF3] mb-12">
          Questions fréquentes
        </h2>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-[#0B0F19]/60 backdrop-blur-xl rounded-xl border border-white/10 px-6"
            >
              <AccordionTrigger className="text-left text-[#E6EAF3] hover:text-[#FF7A00] transition-colors">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-[#E6EAF3]/80 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default HomeFaq;
