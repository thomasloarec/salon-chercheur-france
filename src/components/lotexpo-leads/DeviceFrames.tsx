import { useEffect, useRef, useState } from 'react';
import { Signal, Wifi, BatteryFull } from 'lucide-react';

export const PHONE_W = 390;
export const PHONE_H = 844;
export const DESK_W = 1280;
export const DESK_H = 800;
const SHADOW = '0 30px 60px -20px rgb(11 19 43 / 0.45)';
const SHELL = '#0b132b';
const BEZEL = 12;

/** Hauteur réservée d'un téléphone affiché à `width` px (ratio 844/390). */
export const phoneHeight = (width: number) => (width * PHONE_H) / PHONE_W;
/** Hauteur réservée d'un écran d'ordinateur (barre comprise : 40 px à l'échelle). */
export const browserHeight = (width: number) => (width * DESK_H) / DESK_W;

/** Téléphone à proportions réelles : écran dessiné à 390 × 844 puis réduit. */
export function PhoneFrame({ width = 300, label, children }: { width?: number; label: string; children: React.ReactNode }) {
  const outerW = PHONE_W + BEZEL * 2;
  const outerH = PHONE_H + BEZEL * 2;
  const scale = width / outerW;
  return (
    <div role="img" aria-label={label} data-frame="phone" className="relative mx-auto shrink-0" style={{ width, height: outerH * scale }}>
      <div aria-hidden="true" className="absolute left-0 top-0" style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {/* Boutons latéraux */}
        <span className="absolute rounded-l-sm" style={{ background: SHELL, left: -4, top: 180, width: 4, height: 60 }} />
        <span className="absolute rounded-l-sm" style={{ background: SHELL, left: -4, top: 255, width: 4, height: 60 }} />
        <span className="absolute rounded-r-sm" style={{ background: SHELL, right: -4, top: 220, width: 4, height: 96 }} />
        <div className="relative h-full w-full" style={{ background: SHELL, borderRadius: 56, padding: BEZEL, boxShadow: SHADOW }}>
          <div className="relative h-full w-full overflow-hidden bg-booth-canvas text-foreground" style={{ borderRadius: 44, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.08)' }}>
            <div className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground" style={{ top: 11, width: 126, height: 37 }} />
            <div className="relative z-10 flex items-center justify-between px-8" style={{ height: 54 }}>
              <span className="text-[17px] font-semibold">9:41</span>
              <span className="flex items-center gap-1.5">
                <Signal size={17} /><Wifi size={17} /><BatteryFull size={17} />
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0" style={{ top: 54 }}>{children}</div>
            <div className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground/85" style={{ bottom: 8, width: 134, height: 5 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fenêtre de navigateur : contenu dessiné à 1280 × 800 puis réduit à la largeur mesurée (max 900). */
export function BrowserFrame({ label = "Aperçu de l'accueil du salon sur ordinateur", children, defaultWidth = 340 }: { label?: string; children: React.ReactNode; defaultWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(defaultWidth);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.min(900, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = w / DESK_W;
  return (
    <div ref={ref} className="w-full min-w-0 max-w-[900px]">
      <div role="img" aria-label={label} data-frame="browser" className="relative overflow-hidden border border-border bg-card" style={{ width: '100%', height: browserHeight(w), borderRadius: 14, boxShadow: SHADOW }}>
        <div aria-hidden="true" className="absolute left-0 top-0" style={{ width: DESK_W, height: DESK_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div className="flex items-center gap-4 border-b border-border bg-muted px-4" style={{ height: 40 }}>
            <span className="flex gap-2">
              <i className="h-3 w-3 rounded-full bg-destructive/60" />
              <i className="h-3 w-3 rounded-full bg-warning/60" />
              <i className="h-3 w-3 rounded-full bg-success/60" />
            </span>
            <span className="mx-auto w-[420px] rounded-full bg-background px-4 py-1 text-center text-[13px] text-muted-foreground">lotexpo.com/leads</span>
          </div>
          <div className="absolute inset-x-0 bottom-0" style={{ top: 40 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
