import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import DOMPurify from 'dompurify';

const HomeFaq = () => {
  const faqs = [
    {
      question: 'En quoi est-ce différent de LinkedIn/Twitter ?',
      answer: 'Sur les réseaux sociaux, l\'information se perd dans le flux. Sur LotExpo, tout est centré sur ce qui sera montré en salon : nouveautés triées par secteur, salon et date, avec possibilité de réserver des RDV et télécharger des brochures, le tout au même endroit. Vous ne passez plus à côté des annonces importantes pour votre activité ou des salons à ne pas manquer.'
    },
    {
      question: 'Qui peut publier une Nouveauté ?',
      answer: 'Tout exposant inscrit à un salon professionnel peut publier une nouveauté. Il suffit de créer un compte gratuit et de renseigner votre participation à un événement. Vous pouvez publier 1 nouveauté gratuitement par salon, puis <a href="/exposants" class="text-[#FF7A00] hover:underline">passer en Premium</a> pour publier plus de nouveautés et recevoir des leads en illimité.'
    },
    {
      question: 'Comment fonctionnent les leads ?',
      answer: 'Chaque téléchargement de brochure ou demande de RDV génère un lead que vous pouvez consulter dans votre tableau de bord exposant. En version gratuite, vous recevez jusqu\'à 3 leads par salon (les coordonnées des 3 premiers contacts). Au-delà, <a href="/exposants" class="text-[#FF7A00] hover:underline">passez en Premium</a> (99€ HT/salon) pour recevoir tous les leads sans limitation.'
    },
    {
      question: 'Faut-il créer un compte pour consulter les nouveautés ?',
      answer: 'Non, vous pouvez consulter librement toutes les nouveautés sans créer de compte. Un compte est nécessaire uniquement pour interagir : liker, commenter, et publier des nouveautés.'
    },
    {
      question: 'Quelles données sont publiques ?',
      answer: 'Les nouveautés publiées (titre, description, images, nom de l\'exposant, salon concerné) sont visibles par tous les visiteurs. En revanche, vos informations personnelles (email, téléphone) ne sont jamais rendues publiques et sont uniquement partagées avec les exposants lorsque vous demandez un RDV ou téléchargez une brochure.'
    },
    {
      question: 'Comment fonctionne l\'offre Premium ?',
      answer: 'L\'offre Premium n\'est pas un abonnement mais un paiement unique par événement (99€ HT/salon). Ce paiement vous donne accès à tous les leads générés par vos nouveautés sur cet événement et vous permet de publier jusqu\'à 5 nouveautés. Si votre société participe à plusieurs événements, vous devez activer l\'offre Premium pour chaque événement où vous souhaitez bénéficier de ces avantages.'
    }
  ];

  return (
    <section className="bg-secondary py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
          Questions fréquentes
        </h2>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-card backdrop-blur-xl rounded-xl border border-border px-6"
            >
              <AccordionTrigger className="text-left text-foreground hover:text-accent transition-colors">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(faq.answer, { ADD_TAGS: ['a'], ADD_ATTR: ['href', 'class', 'target'] }) }} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default HomeFaq;
