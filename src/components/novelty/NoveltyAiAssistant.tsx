import React, { useState, useRef } from 'react';
import { Check, Loader2, Sparkles, Lightbulb, FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

const VIOLET = '#6b51ff';

const KIND_LABELS: Record<string, string> = {
  product_photo: 'Photo produit',
  ambiance: 'Ambiance',
  diagram: 'Schéma',
  logo: 'Logo',
  badge: 'Certification',
  portrait: 'Portrait',
  screenshot: 'Capture',
  decor: 'Décoratif',
  unknown: 'Autre',
};

interface Candidate {
  id: string;
  url: string;
  kind: string;
  width: number | null;
  height: number | null;
  selected: boolean;
}


export interface NoveltyAngle {
  id: string;
  libelle?: string;
  title: string;
  type: string;
  reason_1: string;
  reason_2: string | null;
  reason_3: string | null;
  summary: string;
  audience_tags?: string[];
  note_expert?: string;
  alerte?: string | null;
}

interface Props {
  eventId: string;
  exhibitorId: string;
  /** Retourne l'identifiant de l'exposant, en le créant au besoin (une seule fois). */
  ensureExhibitorId?: () => Promise<string | null>;
  currentType?: string;
  canvasHasContent: boolean;
  onApplyAngle: (angle: NoveltyAngle) => void;
}

type Phase = 'idle' | 'analyse' | 'generation';

const STEP_LABELS: Record<Exclude<Phase, 'idle'>, string> = {
  analyse: 'Lecture de votre matière',
  generation: 'Recherche des meilleurs angles',
};

/** Indicateur d'étapes réelles : la première étape est cochée quand on passe à la seconde. */
function AssistantSteps({ phase }: { phase: Exclude<Phase, 'idle'> }) {
  const rows: Array<{ key: Exclude<Phase, 'idle'>; done: boolean; active: boolean }> = [
    { key: 'analyse', done: phase === 'generation', active: phase === 'analyse' },
    { key: 'generation', done: false, active: phase === 'generation' },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div
          key={r.key}
          className={`flex items-center gap-2 text-xs ${
            r.active || r.done ? 'text-foreground' : 'text-muted-foreground/50'
          }`}
        >
          {r.done ? (
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: VIOLET }} />
          ) : r.active ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: VIOLET }} />
          ) : (
            <span className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{STEP_LABELS[r.key]}</span>
        </div>
      ))}
    </div>
  );
}

export default function NoveltyAiAssistant({
  eventId,
  exhibitorId,
  ensureExhibitorId,
  currentType,
  canvasHasContent,
  onApplyAngle,
}: Props) {
  const [matiere, setMatiere] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [conseil, setConseil] = useState<string | null>(null);
  const [pause, setPause] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [angles, setAngles] = useState<NoveltyAngle[]>([]);
  const call = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || null;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novelty-ai-draft`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      },
    );
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* pas de corps JSON */
    }
    return { res, json };
  };

  /** Traite les réponses non-OK communes aux deux actions. Retourne true si géré. */
  const handleFailure = (res: Response, json: any): boolean => {
    if (res.ok) return false;
    if (res.status === 400 && json?.error === 'matiere_insuffisante') {
      setConseil(
        json?.question ||
          "Ajoutez un détail concret : ce que votre nouveauté change pour la personne qui la découvre.",
      );
      return true;
    }
    if (res.status === 429 && json?.error === 'frein_anti_rafale') {
      const min = json?.minutes_avant_reouverture;
      setPause(
        min
          ? `Vous avez généré beaucoup de propositions. Vos crédits reviennent dans ${min} minute${min > 1 ? 's' : ''}.`
          : json?.message || 'Vous avez généré beaucoup de propositions. Revenez dans un moment.',
      );
      return true;
    }
    setErreur("L'assistant n'a pas pu répondre. Réessayez dans un instant.");
    return true;
  };

  const lancer = async () => {
    if (matiere.trim().length < 10 || phase !== 'idle') return;
    setConseil(null);
    setPause(null);
    setErreur(null);
    setAngles([]);
    setPhase('analyse');

    try {
      const resolvedExhibitorId = exhibitorId || (ensureExhibitorId ? await ensureExhibitorId() : null);
      if (!resolvedExhibitorId) {
        setErreur(
          "Impossible d'enregistrer votre entreprise pour le moment. Réessayez dans un instant.",
        );
        return;
      }

      const base: Record<string, unknown> = {
        exhibitor_id: resolvedExhibitorId,
        event_id: eventId,
        texte: matiere.trim(),
        ...(currentType ? { type: currentType } : {}),
      };

      const { res: r1, json: analyse } = await call({ action: 'analyser', ...base });
      if (handleFailure(r1, analyse)) return;
      console.log('[novelty-ai] analyser', analyse);

      if (analyse?.suffisant === false) {
        setConseil(analyse?.question || "Il me manque un élément pour aller plus loin.");
        return;
      }

      setPhase('generation');
      const { res: r2, json: gen } = await call({ action: 'generer', ...base, analyse });
      if (handleFailure(r2, gen)) return;
      console.log('[novelty-ai] generer', gen);

      const list: NoveltyAngle[] = Array.isArray(gen?.angles) ? gen.angles : [];
      if (list.length === 0) {
        setErreur("L'assistant n'a pas trouvé d'angle exploitable. Précisez votre description.");
        return;
      }
      setAngles(list);
    } catch (e) {
      console.error('[novelty-ai]', e);
      setErreur("L'assistant est momentanément indisponible. Réessayez dans un instant.");
    } finally {
      setPhase('idle');
    }
  };

  const appliquer = (angle: NoveltyAngle) => {
    if (canvasHasContent) {
      const ok = window.confirm('Remplacer votre texte actuel par cet angle ?');
      if (!ok) return;
    }
    onApplyAngle(angle);
  };

  const busy = phase !== 'idle';

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: `${VIOLET}4d`, backgroundColor: `${VIOLET}12` }}
    >
      {/* Entête */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: VIOLET }}
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <span className="text-sm font-semibold" style={{ color: VIOLET }}>
            Assistant IA
          </span>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Décrivez votre nouveauté en vrac : l'assistant vous propose des angles qui donnent
            envie de venir la voir.
          </p>
        </div>
      </div>

      {/* Matière */}
      <div className="mt-4 space-y-2">
        <Textarea
          value={matiere}
          onChange={(e) => setMatiere(e.target.value)}
          disabled={busy}
          rows={5}
          placeholder="Décrivez votre nouveauté en vrac"
          className="resize-y bg-background text-sm"
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          L'assistant ne remplace pas vos mots, il révèle pourquoi votre nouveauté mérite une
          visite.
        </p>
        <Button
          type="button"
          onClick={lancer}
          disabled={busy || matiere.trim().length < 10}
          className="w-full text-white hover:opacity-90"
          style={{ backgroundColor: VIOLET }}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Trouver les meilleurs angles
        </Button>
      </div>

      {/* Chargement honnête */}
      {busy && (
        <div className="mt-4 rounded-lg border bg-background/70 p-3" style={{ borderColor: `${VIOLET}33` }}>
          <AssistantSteps phase={phase as Exclude<Phase, 'idle'>} />
        </div>
      )}

      {/* Conseil (matière insuffisante) */}
      {conseil && !busy && (
        <div
          className="mt-4 rounded-lg border bg-background/70 p-3 text-xs leading-relaxed"
          style={{ borderColor: `${VIOLET}33` }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-medium" style={{ color: VIOLET }}>
            <Lightbulb className="h-3.5 w-3.5" />
            Un élément manque encore
          </div>
          <p className="text-muted-foreground">
            Pour en faire une nouveauté qui donne envie de venir, il manque un élément :
          </p>
          <p className="mt-1 text-foreground">{conseil}</p>
        </div>
      )}

      {/* Frein anti-rafale */}
      {pause && !busy && (
        <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
          {pause}
        </p>
      )}

      {/* Erreur générique */}
      {erreur && !busy && (
        <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
          {erreur}
        </p>
      )}

      {/* Angles */}
      {angles.length > 0 && !busy && (
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: VIOLET }}>
            {angles.length} angle{angles.length > 1 ? 's' : ''} proposé
            {angles.length > 1 ? 's' : ''}
          </h3>
          {angles.map((angle) => (
            <article
              key={angle.id}
              className="rounded-lg border bg-background p-3 shadow-sm"
              style={{ borderColor: `${VIOLET}33` }}
            >
              <h4 className="text-sm font-semibold leading-snug">{angle.title}</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {angle.reason_1?.length > 220
                  ? `${angle.reason_1.slice(0, 220).trimEnd()}…`
                  : angle.reason_1}
              </p>
              {angle.note_expert && (
                <div
                  className="mt-3 rounded-md border-l-2 py-2 pl-3 pr-2 text-[11px] italic leading-relaxed"
                  style={{
                    borderColor: VIOLET,
                    backgroundColor: `${VIOLET}0f`,
                    color: VIOLET,
                  }}
                >
                  {angle.note_expert}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => appliquer(angle)}
                className="mt-3 w-full"
                style={{ borderColor: VIOLET, color: VIOLET }}
              >
                Utiliser cet angle
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
