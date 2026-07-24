import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const DesinscriptionConfirmee = () => {
  return (
    <>
      <Helmet>
        <title>Désinscription confirmée – Lotexpo</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <MainLayout>
        <div className="flex items-center justify-center py-16 px-4">
          <Card className="w-full max-w-xl">
            <CardContent className="p-8 sm:p-12 space-y-8">
              <div className="flex flex-col items-center text-center space-y-4">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <h1 className="heading-display text-2xl sm:text-3xl font-semibold text-foreground">
                  Vous êtes désinscrit
                </h1>
              </div>

              <div className="space-y-4 text-foreground leading-relaxed">
                <p>
                  Cette adresse ne recevra plus aucun email de Lotexpo concernant les
                  salons professionnels, quel que soit le salon.
                </p>
                <p>
                  La demande a été prise en compte immédiatement. Aucune action
                  supplémentaire n'est nécessaire de votre part.
                </p>
              </div>

              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="font-semibold">You have been unsubscribed.</strong>{' '}
                  This address will no longer receive any email from Lotexpo about trade
                  shows. The request took effect immediately and requires no further
                  action.
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <Button asChild variant="outline">
                  <Link to="/">Découvrir Lotexpo</Link>
                </Button>
              </div>

              <div className="border-t pt-6 space-y-1 text-center text-xs text-muted-foreground">
                <p>
                  Une question sur vos données ?{' '}
                  <a href="mailto:admin@lotexpo.com" className="underline">
                    admin@lotexpo.com
                  </a>
                </p>
                <p>
                  Any question about your data?{' '}
                  <a href="mailto:admin@lotexpo.com" className="underline">
                    admin@lotexpo.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </>
  );
};

export default DesinscriptionConfirmee;