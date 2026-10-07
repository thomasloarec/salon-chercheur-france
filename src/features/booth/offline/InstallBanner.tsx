import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KEY = 'lotexpo-leads:install-dismissed';
const WEEK = 7 * 86_400_000;

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<unknown> };

const isStandalone = () => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

const isIos = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
};

const wasDismissed = () => {
  try {
    const t = Number(localStorage.getItem(KEY) ?? 0);
    return t > 0 && Date.now() - t < WEEK;
  } catch {
    return false;
  }
};

export default function InstallBanner({ pendingCount }: { pendingCount: number }) {
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed());
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const ios = isIos();

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as PromptEvent);
    };
    const installed = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', h);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignoré */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
    } catch {
      /* ignoré */
    }
    setPromptEvent(null);
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-3 pr-12 text-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      {promptEvent ? (
        <div className="flex flex-col gap-2">
          <p>Installez le mode salon pour l'ouvrir même sans réseau.</p>
          <Button className="min-h-[44px] self-start" onClick={() => void install()}>
            Installer
          </Button>
        </div>
      ) : ios ? (
        <p>
          Pour l'ouvrir même sans réseau : touchez Partager, puis Sur l'écran d'accueil. Ouvrez ensuite
          l'application, connectez-vous et ouvrez ce salon une fois avec du réseau.
        </p>
      ) : (
        <p>Ajoutez cette page à l'écran d'accueil depuis le menu du navigateur.</p>
      )}
      {ios && pendingCount > 0 && (
        <p className="mt-2 font-medium text-amber-700 dark:text-amber-300">
          Attendez que vos rencontres soient envoyées avant d'installer : sur iPhone, l'application installée ne
          voit pas les données du navigateur.
        </p>
      )}
    </div>
  );
}
