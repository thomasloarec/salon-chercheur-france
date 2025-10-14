import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Sparkles, Calendar, Bell, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NoveltiesPreLaunchBannerProps {
  eventDate: string;
  eventName: string;
  onNotifyMe?: () => void;
}

export function NoveltiesPreLaunchBanner({ 
  eventDate, 
  eventName,
  onNotifyMe 
}: NoveltiesPreLaunchBannerProps) {
  const daysUntilEvent = differenceInDays(new Date(eventDate), new Date());
  const daysUntilNovelties = Math.max(0, daysUntilEvent - 60);
  
  // Date d'ouverture des nouveautés (J-60)
  const noveltiesOpenDate = new Date(eventDate);
  noveltiesOpenDate.setDate(noveltiesOpenDate.getDate() - 60);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="relative p-8 md:p-12 text-center">
        {/* Icône principale */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        </div>

        {/* Titre principal */}
        <h3 className="text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          Les nouveautés arrivent bientôt
        </h3>

        {/* Sous-titre explicatif */}
        <p className="text-base text-muted-foreground mb-6 max-w-2xl mx-auto">
          Les exposants de <strong>{eventName}</strong> dévoileront leurs innovations 
          <br className="hidden sm:inline" />
          <strong> à partir du {format(noveltiesOpenDate, 'dd MMMM yyyy', { locale: fr })}</strong>
        </p>

        {/* Timeline visuelle élégante */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary mb-2" />
              <span className="text-xs text-muted-foreground">Aujourd'hui</span>
            </div>
            
            <div className="flex-1 h-0.5 bg-gradient-to-r from-primary via-primary/30 to-muted mx-4 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <Badge variant="secondary" className="text-xs whitespace-nowrap px-3 py-1">
                  {daysUntilNovelties} jour{daysUntilNovelties > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-muted mb-2 animate-pulse" />
              <span className="text-xs text-muted-foreground">Nouveautés</span>
            </div>
            
            <div className="flex-1 h-0.5 bg-muted mx-4" />
            
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-muted mb-2" />
              <span className="text-xs text-muted-foreground">Salon</span>
            </div>
          </div>
        </div>

        {/* CTA notification - UN SEUL BOUTON */}
        <div className="flex justify-center">
          {onNotifyMe && (
            <Button 
              onClick={onNotifyMe}
              size="lg"
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              Me notifier à l'ouverture
            </Button>
          )}
        </div>

        {/* Note pour exposants */}
        <div className="mt-8 pt-6 border-t border-primary/10">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" />
            <span>
              <strong>Exposants :</strong> La publication de nouveautés ouvrira 60 jours avant l'événement
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}