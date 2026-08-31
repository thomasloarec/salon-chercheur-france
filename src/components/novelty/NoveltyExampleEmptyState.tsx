import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import DarkTexturePanel from '@/components/event/DarkTexturePanel';
import type { Event } from '@/types/event';

interface NoveltyExampleEmptyStateProps {
  event: Event;
  exhibitorCount?: number;
  className?: string;
}

/**
 * Empty-state salon (aucune nouveauté publiée).
 * Deux leviers seulement : rareté (« la première place est libre ») et coût
 * d'entrée quasi nul (« l'IA rédige, vous validez »). Un seul moment animé :
 * la démo « PDF -> nouveauté », en CSS pur. Le PDF y est une démonstration,
 * jamais un prérequis.
 */
export default function NoveltyExampleEmptyState({
  event,
  exhibitorCount,
  className,
}: NoveltyExampleEmptyStateProps) {
  const count =
    typeof exhibitorCount === 'number' && Number.isFinite(exhibitorCount)
      ? exhibitorCount
      : 0;

  const proof =
    count > 1
      ? `${count} exposants sont listés sur ce salon. Aucun n’a encore publié : la première place est libre.`
      : count === 1
        ? 'Un exposant est listé sur ce salon. La première place est libre.'
        : 'Les visiteurs qui consultent cette page préparent déjà leur venue.';

  // Démo IA : cycle de phases piloté en JS, sans dépendance externe.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setPhase(5);
      return;
    }
    const seq: Array<[number, number]> = [
      [0, 400], [1, 900], [2, 1500], [3, 1500], [4, 1500], [5, 1900],
    ];
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const [p, d] = seq[i];
      setPhase(p);
      i = (i + 1) % seq.length;
      timer = setTimeout(tick, d);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <DarkTexturePanel className={cn('w-full', className)}>
      {/* halo violet discret qui respire */}
      <div
        aria-hidden
        className="nx-glow pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full"
      />

      <div className="relative mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* Colonne texte */}
          <div className="flex flex-col items-start gap-4">
            <span className="nx-badge inline-flex items-center gap-2 overflow-hidden rounded-full border border-inverse-primary/40 bg-inverse-primary/15 px-3 py-1.5 text-xs font-semibold text-inverse">
              <span className="h-1.5 w-1.5 rounded-full bg-inverse-primary" />
              Création par IA · Nouveau
            </span>

            <span className="text-xs font-medium uppercase tracking-[0.14em] text-inverse/70">
              Espace exposants
            </span>

            <h2 className="heading-display text-2xl leading-tight text-inverse sm:text-3xl">
              Soyez le premier à publier. Sans rien rédiger.
            </h2>

            <p className="text-base leading-relaxed text-inverse/85 sm:text-lg">
              Vous présentez un produit ou une solution sur ce salon ? Notre IA rédige votre
              nouveauté à votre place : claire, percutante, prête à publier. Vous relisez, vous
              ajustez, c'est en ligne.
            </p>

            <p className="text-base font-medium leading-snug text-inverse sm:text-lg">{proof}</p>

            <AddNoveltyButton
              event={event}
              label="Créer ma nouveauté avec l'IA"
              size="lg"
              className="nx-cta"
            />

            <p className="text-xs text-inverse/75">
              Gratuit · Vous validez avant publication · Visible avant l'ouverture
            </p>
          </div>

          {/* Colonne démo (seul moment animé) */}
          <div className="w-full">
            <div className="nx-demo" data-phase={phase} aria-hidden>
              <div className="nx-stage nx-pdf">
                <div className="nx-pdfdoc">
                  <span className="nx-ln nx-a" />
                  <span className="nx-ln nx-b" />
                  <span className="nx-ln nx-c" />
                  <span className="nx-ln nx-d" />
                  <span className="nx-pdftag">PDF</span>
                  <span className="nx-scan" />
                </div>
              </div>

              <div className="nx-stage nx-arrow">
                <span className="nx-arrowchip"><span className="nx-spark">✦</span> L'IA rédige</span>
              </div>

              <div className="nx-stage nx-gen">
                <div className="nx-gencard">
                  <div className="nx-cap">Nouveauté</div>
                  <div className="nx-skels">
                    <span className="nx-skel nx-t" />
                    <span className="nx-skel" />
                    <span className="nx-skel nx-s2" />
                    <span className="nx-skel nx-s3" />
                  </div>
                  <div className="nx-real">
                    <p className="nx-rt font-display">Notre nouvelle solution, en avant-première</p>
                    <p className="nx-rl">À découvrir sur notre stand : gain de temps, conformité, démo en direct.</p>
                    <span className="nx-pub">✓ Publiée, visible avant l'ouverture</span>
                  </div>
                </div>
              </div>

              <div className="nx-caption">L'IA rédige votre nouveauté</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .nx-glow{
          background: radial-gradient(closest-side, hsl(var(--primary-inverse) / 0.22), transparent 70%);
          filter: blur(24px);
          animation: nx-breathe 9s ease-in-out infinite;
        }
        @keyframes nx-breathe{0%,100%{opacity:.5;transform:translate(0,0)}50%{opacity:.85;transform:translate(-12px,8px)}}

        .nx-badge{position:relative}
        .nx-badge::after{content:"";position:absolute;inset:0;border-radius:inherit;
          background:linear-gradient(100deg,transparent 20%,hsl(var(--on-inverse) / .32) 50%,transparent 80%);
          transform:translateX(-120%);animation:nx-sweep 4.5s ease-in-out infinite}
        @keyframes nx-sweep{0%,60%{transform:translateX(-120%)}80%,100%{transform:translateX(120%)}}

        .nx-cta{position:relative}
        .nx-cta::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;animation:nx-pulse 2.8s ease-out infinite}
        @keyframes nx-pulse{
          0%{box-shadow:0 0 0 0 hsl(var(--primary-inverse) / .5)}
          70%{box-shadow:0 0 0 14px hsl(var(--primary-inverse) / 0)}
          100%{box-shadow:0 0 0 0 hsl(var(--primary-inverse) / 0)}
        }

        .nx-demo{position:relative;height:300px;border-radius:16px;
          background:hsl(var(--surface-inverse) / .5);
          border:1px solid hsl(var(--primary-inverse) / .16);overflow:hidden}
        .nx-stage{position:absolute;transition:opacity .5s ease, transform .5s ease}

        .nx-pdf{left:30px;top:50%;transform:translateY(-50%) scale(.9);opacity:0}
        .nx-demo[data-phase="1"] .nx-pdf,.nx-demo[data-phase="2"] .nx-pdf{opacity:1;transform:translateY(-50%) scale(1)}
        .nx-demo[data-phase="3"] .nx-pdf,.nx-demo[data-phase="4"] .nx-pdf,.nx-demo[data-phase="5"] .nx-pdf{opacity:.32;transform:translateY(-50%) scale(.85) translateX(-6px)}
        .nx-pdfdoc{width:98px;height:126px;border-radius:8px;background:linear-gradient(160deg,#fdfdff,#e7e9f6);position:relative;box-shadow:0 16px 30px -10px rgba(0,0,0,.6)}
        .nx-ln{position:absolute;left:11px;right:13px;height:5px;border-radius:3px;background:#d3d7ee}
        .nx-a{top:15px;width:52%}.nx-b{top:28px}.nx-c{top:41px}.nx-d{top:54px;width:70%}
        .nx-pdftag{position:absolute;left:9px;bottom:9px;font-size:9px;font-weight:700;color:#fff;background:#e5484d;padding:2px 6px;border-radius:4px;letter-spacing:.04em}
        .nx-scan{position:absolute;left:0;right:0;height:24px;background:linear-gradient(180deg,transparent,hsl(var(--primary-inverse) / .55),transparent);opacity:0}
        .nx-demo[data-phase="2"] .nx-scan{opacity:1;animation:nx-scan 1.3s ease-in-out infinite}
        @keyframes nx-scan{0%{top:-8px}100%{top:112px}}

        .nx-arrow{left:50%;top:50%;transform:translate(-50%,-50%);opacity:0;text-align:center}
        .nx-demo[data-phase="2"] .nx-arrow,.nx-demo[data-phase="3"] .nx-arrow{opacity:1}
        .nx-arrowchip{font-size:11px;font-weight:600;color:hsl(var(--on-inverse));background:hsl(var(--primary-inverse) / .3);border:1px solid hsl(var(--primary-inverse) / .5);padding:4px 10px;border-radius:999px;display:inline-flex;gap:6px;align-items:center}
        .nx-spark{display:inline-block;animation:nx-spin 2.2s linear infinite}
        @keyframes nx-spin{to{transform:rotate(360deg)}}

        .nx-gen{right:22px;top:50%;transform:translateY(-50%) translateX(16px);opacity:0;width:228px}
        .nx-demo[data-phase="3"] .nx-gen,.nx-demo[data-phase="4"] .nx-gen,.nx-demo[data-phase="5"] .nx-gen{opacity:1;transform:translateY(-50%) translateX(0)}
        .nx-gencard{background:linear-gradient(165deg, hsl(var(--surface-inverse) / .96), hsl(var(--surface-inverse) / .82));border:1px solid hsl(var(--primary-inverse) / .3);border-radius:12px;padding:14px 15px;box-shadow:0 20px 40px -14px rgba(0,0,0,.7)}
        .nx-cap{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:hsl(var(--primary-inverse));margin-bottom:10px}
        .nx-skel{display:block;height:11px;border-radius:5px;background:linear-gradient(90deg, hsl(var(--primary-inverse) / .12), hsl(var(--primary-inverse) / .28), hsl(var(--primary-inverse) / .12));background-size:200% 100%;animation:nx-shimmer 1.2s linear infinite;margin-bottom:9px}
        @keyframes nx-shimmer{to{background-position:-200% 0}}
        .nx-t{height:15px;width:80%}.nx-s2{width:92%}.nx-s3{width:60%;margin-bottom:0}
        .nx-real{display:none}
        .nx-rt{font-weight:600;color:#fff;font-size:15px;line-height:1.22;margin:0 0 8px}
        .nx-rl{font-size:12px;color:hsl(var(--on-inverse) / .82);line-height:1.5;margin:0}
        .nx-demo[data-phase="4"] .nx-skels,.nx-demo[data-phase="5"] .nx-skels{display:none}
        .nx-demo[data-phase="4"] .nx-real,.nx-demo[data-phase="5"] .nx-real{display:block}
        .nx-pub{display:inline-block;margin-top:11px;font-size:11px;font-weight:600;color:#7ef0c0;opacity:0;transform:translateY(4px);transition:.4s}
        .nx-demo[data-phase="5"] .nx-pub{opacity:1;transform:translateY(0)}
        .nx-caption{position:absolute;left:0;right:0;bottom:13px;text-align:center;font-size:11px;color:hsl(var(--on-inverse) / .6)}

        @media (max-width:1023px){.nx-demo{height:280px}}
        @media (prefers-reduced-motion: reduce){
          .nx-glow,.nx-badge::after,.nx-cta::after,.nx-scan,.nx-spark,.nx-skel{animation:none !important}
        }
      `}</style>
    </DarkTexturePanel>
  );
}
