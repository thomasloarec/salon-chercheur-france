import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import RechercheIAChat from '@/components/recherche-ia/RechercheIAChat';

/**
 * Déclencheur flottant (FAB) + Sheet contenant l'expérience de chat « Recherche IA ».
 * S'imbrique dans la page liste des salons sans navigation ni impact sur la grille.
 */
const RechercheIASidebarTrigger = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB en bas à droite */}
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir la Recherche IA"
        className="fixed bottom-6 right-6 z-40 h-auto rounded-full bg-accent px-5 py-3 text-accent-foreground shadow-lg hover:bg-accent/90 flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-semibold">Recherche IA</span>
        <span className="rounded-full bg-accent-foreground/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Beta
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 heading-display text-lg">
              <Sparkles className="h-4 w-4 text-accent" />
              Recherche IA
              <Badge className="bg-secondary text-primary hover:bg-secondary text-[10px] uppercase tracking-wide">
                Beta
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
            <RechercheIAChat variant="sidebar" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default RechercheIASidebarTrigger;
