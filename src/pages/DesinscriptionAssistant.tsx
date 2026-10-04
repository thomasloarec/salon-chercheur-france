import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type State = 'idle' | 'busy' | 'done' | 'invalid' | 'error';

export default function DesinscriptionAssistant() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'idle' : 'invalid');
  const [deja, setDeja] = useState(false);

  const unsubscribe = async () => {
    setState('busy');
    const { data, error } = await supabase.functions.invoke('assistant-alerts-unsubscribe', { body: { token } });
    if (error) {
      const status = (error as any)?.context?.status;
      setState(status === 400 ? 'invalid' : 'error');
      return;
    }
    if (!data?.ok) {
      setState('invalid');
      return;
    }
    setDeja(data.deja === true);
    setState('done');
  };

  return (
    <>
      <Helmet>
        <title>Emails de votre assistant | Lotexpo</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center">
            {state === 'done' ? (
              <>
                <h1 className="heading-display text-[28px] leading-tight text-foreground">
                  {deja ? 'Vous êtes déjà désinscrit' : "C'est noté"}
                </h1>
                <p className="mt-4 text-base text-muted-foreground">
                  Votre assistant salons ne vous enverra plus d'emails. Votre agenda et les notifications du site restent actifs.
                </p>
                <Button asChild className="mt-6 min-h-12">
                  <Link to="/agenda">Revenir à mon agenda</Link>
                </Button>
              </>
            ) : state === 'invalid' ? (
              <>
                <p className="text-base text-foreground">
                  Ce lien de désinscription est incomplet ou n'est plus valide. Vous pouvez couper les emails depuis votre agenda.
                </p>
                <Link to="/agenda" className="mt-6 inline-block font-medium text-primary underline underline-offset-4">
                  Aller à mon agenda
                </Link>
              </>
            ) : (
              <>
                <h1 className="heading-display text-[28px] leading-tight text-foreground">
                  Ne plus recevoir les emails de votre assistant ?
                </h1>
                <p className="mt-4 text-base text-muted-foreground">
                  Votre assistant salons continuera de remplir votre agenda, mais il ne vous écrira plus. Vous pourrez réactiver les emails depuis votre agenda.
                </p>
                {state === 'error' && (
                  <p role="alert" className="mt-4 text-[15px] text-destructive">
                    La désinscription n'a pas abouti. Réessayez dans un instant.
                  </p>
                )}
                <div className="mt-6 flex flex-col items-center gap-4">
                  <Button className="min-h-12 w-full sm:w-auto" onClick={unsubscribe} disabled={state === 'busy'}>
                    {state === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                    {state === 'busy' ? 'Un instant…' : 'Ne plus recevoir ces emails'}
                  </Button>
                  <Link to="/agenda" className="font-medium text-primary underline underline-offset-4">
                    Garder les emails et revenir à mon agenda
                  </Link>
                </div>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
