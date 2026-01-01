import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Schema de validation
const contactSchema = z.object({
  prenom: z.string().min(1, "Le prénom est requis").max(100),
  nom: z.string().min(1, "Le nom est requis").max(100),
  email: z.string().email("Email invalide").max(255),
  telephone: z.string().max(20).optional().or(z.literal('')),
  objet: z.string().min(1, "L'objet est requis").max(200),
  description: z.string().min(10, "La description doit contenir au moins 10 caractères").max(2000),
  captcha: z.string().refine(val => val !== '', "Veuillez répondre à la question de sécurité"),
  honeypot: z.string().max(0) // Champ piège anti-bot
});

type ContactFormData = z.infer<typeof contactSchema>;

// Générer une question mathématique simple
const generateCaptcha = () => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b} = ?`, answer: (a + b).toString() };
};

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      prenom: '',
      nom: '',
      email: '',
      telephone: '',
      objet: '',
      description: '',
      captcha: '',
      honeypot: ''
    }
  });

  const captchaValue = watch('captcha');

  const onSubmit = async (data: ContactFormData) => {
    // Vérification honeypot (anti-bot)
    if (data.honeypot) {
      console.log('Bot detected');
      return;
    }

    // Vérification captcha
    if (data.captcha !== captcha.answer) {
      toast({
        title: "Erreur",
        description: "La réponse à la question de sécurité est incorrecte.",
        variant: "destructive"
      });
      setCaptcha(generateCaptcha());
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('contact-submit', {
        body: {
          prenom: data.prenom.trim(),
          nom: data.nom.trim(),
          email: data.email.trim().toLowerCase(),
          telephone: data.telephone?.trim() || '',
          objet: data.objet.trim(),
          description: data.description.trim()
        }
      });

      if (error) throw error;

      setIsSuccess(true);
      reset();
      setCaptcha(generateCaptcha());
      
      toast({
        title: "Message envoyé",
        description: "Nous avons bien reçu votre message et vous répondrons dans les plus brefs délais."
      });

    } catch (error) {
      console.error('Erreur envoi contact:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi du message. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-foreground mb-3">Contactez-nous</h1>
            <p className="text-muted-foreground">
              Une question, une suggestion ? Nous sommes à votre écoute.
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-green-800 dark:text-green-300 mb-2">
                Message envoyé avec succès
              </h2>
              <p className="text-green-700 dark:text-green-400 mb-6">
                Merci pour votre message. Nous vous répondrons dans les plus brefs délais.
              </p>
              <Button onClick={() => setIsSuccess(false)} variant="outline">
                Envoyer un autre message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-card p-8 rounded-lg border border-border shadow-sm">
              {/* Honeypot - champ invisible pour les bots */}
              <input
                type="text"
                {...register('honeypot')}
                className="absolute opacity-0 pointer-events-none h-0 w-0"
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input
                    id="prenom"
                    {...register('prenom')}
                    placeholder="Votre prénom"
                    className={errors.prenom ? 'border-destructive' : ''}
                  />
                  {errors.prenom && (
                    <p className="text-sm text-destructive">{errors.prenom.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input
                    id="nom"
                    {...register('nom')}
                    placeholder="Votre nom"
                    className={errors.nom ? 'border-destructive' : ''}
                  />
                  {errors.nom && (
                    <p className="text-sm text-destructive">{errors.nom.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="votre@email.com"
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    type="tel"
                    {...register('telephone')}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objet">Objet *</Label>
                <Input
                  id="objet"
                  {...register('objet')}
                  placeholder="Objet de votre message"
                  className={errors.objet ? 'border-destructive' : ''}
                />
                {errors.objet && (
                  <p className="text-sm text-destructive">{errors.objet.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Message *</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Décrivez votre demande..."
                  rows={5}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>

              {/* Question de sécurité (captcha mathématique) */}
              <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
                <Label htmlFor="captcha" className="flex items-center gap-2">
                  <span>Question de sécurité *</span>
                </Label>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-foreground whitespace-nowrap">
                    {captcha.question}
                  </span>
                  <Input
                    id="captcha"
                    type="text"
                    {...register('captcha')}
                    placeholder="Votre réponse"
                    className={`max-w-[120px] ${errors.captcha ? 'border-destructive' : ''}`}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCaptcha(generateCaptcha())}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Changer
                  </Button>
                </div>
                {errors.captcha && (
                  <p className="text-sm text-destructive">{errors.captcha.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Envoyer le message
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
