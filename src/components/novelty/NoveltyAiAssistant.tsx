import React, { useState, useRef, useEffect } from 'react';
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
  onApplyImages?: (files: File[]) => void;
  onApplyBrochure?: (file: File) => void;
}

const MAX_IMAGE_SIDE = 1600;

/** Redimensionne une image côté navigateur (max 1600px, JPEG 0.82). */
async function resizeImage(file: File): Promise<File> {
  try {
    const bitmapUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = bitmapUrl;
    });
    const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no_ctx');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(bitmapUrl);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    if (!blob) throw new Error('no_blob');
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
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
  onApplyImages,
  onApplyBrochure,

}: Props) {
  const [matiere, setMatiere] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [conseil, setConseil] = useState<string | null>(null);
  const [pause, setPause] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [angles, setAngles] = useState<NoveltyAngle[]>([]);

  // --- Import PDF (Lot 6a) ---
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPhase, setPdfPhase] = useState<'idle' | 'upload' | 'extraction' | 'done' | 'error'>('idle');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  // Vrai depuis le début d'un import PDF jusqu'à la fin de la séquence automatique.
  const [pdfSequence, setPdfSequence] = useState(false);
  const [sourceDocId, setSourceDocId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [maxSelectionWarning, setMaxSelectionWarning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);
  const lancerRef = useRef<(() => Promise<void>) | null>(null);
  const autoRunKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (angles.length > 0) {
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [angles.length]);

  // Enchaînement automatique : dès que l'import PDF est terminé avec du texte
  // exploitable, on lance la génération d'angles (une seule fois par import).
  useEffect(() => {
    if (pdfPhase !== 'done') return;
    if (matiere.trim().length < 10) return;
    const key = sourceDocId || 'pdf';
    if (autoRunKeyRef.current === key) return;
    autoRunKeyRef.current = key;
    void (async () => {
      try {
        await lancerRef.current?.();
      } finally {
        setPdfSequence(false);
      }
    })();
  }, [pdfPhase, matiere, sourceDocId]);


  /** Télécharge + redimensionne les candidats cochés (avec cache par id). */
  const buildSelectedFiles = async (list: Candidate[]): Promise<File[]> => {
    const out: File[] = [];
    for (const c of list.filter((x) => x.selected).slice(0, 3)) {
      const cached = fileCacheRef.current.get(c.id);
      if (cached) {
        out.push(cached);
        continue;
      }
      try {
        const blob = await (await fetch(c.url)).blob();
        const raw = new File([blob], `${c.id}.jpg`, { type: blob.type || 'image/jpeg' });
        const resized = await resizeImage(raw);
        fileCacheRef.current.set(c.id, resized);
        out.push(resized);
      } catch (e) {
        console.error('[novelty-pdf] image', e);
      }
    }
    return out;
  };

  const pushSelection = async (list: Candidate[]) => {
    if (!onApplyImages) return;
    const files = await buildSelectedFiles(list);
    onApplyImages(files);
  };


  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || null;
    return {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  };

  const handlePdf = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setPdfError('Seuls les fichiers PDF sont acceptés.');
      setPdfPhase('error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPdfError('Le PDF ne doit pas dépasser 20 Mo.');
      setPdfPhase('error');
      return;
    }
    setPdfError(null);
    setPdfNotice(null);
    setCandidates([]);
    setSourceDocId(null);
    autoRunKeyRef.current = null;
    setPdfFile(file);


    try {
      setPdfPhase('upload');
      const path = `pdf-import/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from('novelty-resources').upload(path, file, {
        contentType: 'application/pdf',
      });
      if (up.error) throw new Error(up.error.message);

      setPdfPhase('extraction');
      const headers = await authHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novelty-pdf-extract`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ storage_path: path, exhibitor_id: exhibitorId, event_id: eventId }),
        },
      );
      const json: any = await res.json().catch(() => null);
      const documentId = json?.document_id;
      if (!res.ok || !documentId) throw new Error(json?.error || 'extraction_failed');

      const { data: docRow } = await supabase
        .from('novelty_source_documents')
        .select('extracted_text, image_candidate_count, status')
        .eq('id', documentId)
        .single();

      const text = (docRow?.extracted_text || '').trim();
      if (text) {
        setMatiere(text);
      } else {
        setPdfNotice(
          "Ce PDF ne contient pas de texte exploitable. Décrivez votre nouveauté dans la zone ci-dessous, ou importez un autre PDF.",
        );
        setPdfSequence(false);
      }

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novelty-images-qualify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ document_id: documentId }),
      }).catch(() => null);

      const { data: rows } = await supabase
        .from('novelty_source_images')
        .select('id, storage_bucket, storage_path, width, height, kind, selected')
        .eq('source_document_id', documentId)
        .order('selected', { ascending: false })
        .order('score', { ascending: false });

      const list: Candidate[] = [];
      for (const row of rows || []) {
        const { data: signed } = await supabase.storage
          .from(row.storage_bucket)
          .createSignedUrl(row.storage_path, 3600);
        if (!signed?.signedUrl) continue;
        list.push({
          id: row.id,
          url: signed.signedUrl,
          kind: row.kind || 'unknown',
          width: row.width,
          height: row.height,
          selected: !!row.selected,
        });
      }
      setCandidates(list);
      setSourceDocId(documentId);
      setPdfPhase('done');
      onApplyBrochure?.(file);
      void pushSelection(list);

    } catch (e) {
      console.error('[novelty-pdf]', e);
      setPdfError("Le PDF n'a pas pu être traité. Vous pouvez décrire votre nouveauté à la main.");
      setPdfPhase('error');
      setPdfSequence(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setCandidates((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target) return prev;
      if (!target.selected && prev.filter((c) => c.selected).length >= 3) {
        setMaxSelectionWarning(true);
        window.setTimeout(() => setMaxSelectionWarning(false), 2500);
        return prev;
      }
      setMaxSelectionWarning(false);
      const next = prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c));
      void pushSelection(next);
      return next;
    });
  };


  const pdfBusy = pdfPhase === 'upload' || pdfPhase === 'extraction';

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

  lancerRef.current = lancer;



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

      {/* Import PDF */}
      <div className="mt-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => !pdfBusy && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !pdfBusy) fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f && !pdfBusy) handlePdf(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
            pdfBusy ? 'cursor-wait opacity-70' : ''
          }`}
          style={{
            borderColor: VIOLET,
            backgroundColor: dragOver ? `${VIOLET}1f` : 'transparent',
          }}
        >
          <FileUp className="h-4 w-4" style={{ color: VIOLET }} />
          <p className="mt-1.5 text-xs font-medium" style={{ color: VIOLET }}>
            Ou importez un PDF (plaquette, présentation) et on s'occupe du reste
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">PDF uniquement, 20 Mo maximum</p>
          {pdfFile && !pdfBusy && (
            <span className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              <span className="truncate">{pdfFile.name}</span>
              <X
                className="h-3 w-3 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setPdfFile(null);
                  setCandidates([]);
                  setSourceDocId(null);
                  setPdfPhase('idle');
                  setPdfError(null);
                  setPdfNotice(null);
                }}
              />
            </span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) handlePdf(f);
          }}
        />

        {(pdfBusy || busy) && (
          <div
            className="mt-3 rounded-lg border bg-background/70 p-3 text-xs"
            style={{ borderColor: `${VIOLET}33` }}
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: VIOLET }} />
              <span>
                {pdfPhase === 'upload'
                  ? 'Envoi du PDF…'
                  : pdfPhase === 'extraction'
                    ? 'Lecture du PDF et analyse des images, cela peut prendre jusqu\u2019à une minute'
                    : phase === 'analyse'
                      ? 'Analyse de votre matière…'
                      : 'Recherche des meilleurs angles…'}
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-pulse rounded-full" style={{ backgroundColor: VIOLET }} />
            </div>
          </div>
        )}

        {pdfError && !pdfBusy && (
          <p className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
            {pdfError}
          </p>
        )}
        {pdfNotice && !pdfBusy && (
          <p className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
            {pdfNotice}
          </p>
        )}
      </div>

      {/* Galerie de candidats issus du PDF */}
      {pdfPhase === 'done' && candidates.length === 0 && (
        <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
          Aucune image exploitable trouvée dans ce PDF. Vous pourrez ajouter vos propres images à
          l'étape suivante.
        </p>
      )}

      {candidates.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: VIOLET }}>
            Images trouvées dans le PDF
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCandidate(c.id)}
                className="group relative overflow-hidden rounded-lg border bg-background text-left"
                style={{ borderColor: c.selected ? VIOLET : `${VIOLET}33` }}
              >
                <img
                  src={c.url}
                  alt={KIND_LABELS[c.kind] || 'Image extraite du PDF'}
                  loading="lazy"
                  className="h-24 w-full object-cover"
                />
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border bg-background"
                  style={{ borderColor: VIOLET, backgroundColor: c.selected ? VIOLET : undefined }}
                >
                  {c.selected && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className="block truncate px-2 py-1 text-[11px] text-muted-foreground">
                  {KIND_LABELS[c.kind] || 'Autre'}
                </span>
              </button>
            ))}
          </div>
          {maxSelectionWarning && (
            <p className="mt-2 text-[11px]" style={{ color: VIOLET }}>
              3 images maximum
            </p>
          )}
        </div>
      )}



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
        <div ref={resultsRef} className="mt-5 space-y-3">
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
