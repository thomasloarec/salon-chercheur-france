import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  Loader2,
  Sparkles,
  Lightbulb,
  FileUp,
  X,
  RefreshCw,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
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
const RETRY_DELAY_MS = 1500;

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

/** Issue d'une génération d'angles. */
type Outcome = 'ok' | 'conseil' | 'pause' | 'erreur';

/* ---------- Séquence PDF : un seul bloc d'attente, trois étapes réelles ---------- */

type SeqKey = 'lecture' | 'angles' | 'images';
type SeqStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';
type SeqState = Record<SeqKey, SeqStatus>;

const SEQ_ORDER: SeqKey[] = ['lecture', 'angles', 'images'];
const SEQ_LABELS: Record<SeqKey, string> = {
  lecture: 'Lecture de votre PDF',
  angles: 'Rédaction des angles',
  images: 'Sélection des images',
};
const SEQ_INITIAL: SeqState = { lecture: 'pending', angles: 'pending', images: 'pending' };

function SequenceBlock({ seq, fileName }: { seq: SeqState; fileName: string | null }) {
  return (
    <div
      className="mt-4 rounded-lg border bg-background/80 p-4"
      style={{ borderColor: `${VIOLET}33` }}
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-medium text-foreground">
        On prépare vos propositions à partir de votre PDF
      </p>
      {fileName && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{fileName}</p>}
      <ol className="mt-3 space-y-2">
        {SEQ_ORDER.filter((k) => seq[k] !== 'skipped').map((k) => {
          const s = seq[k];
          return (
            <li
              key={k}
              className={`flex items-center gap-2 text-xs ${
                s === 'pending' ? 'text-muted-foreground/60' : 'text-foreground'
              }`}
            >
              {s === 'done' ? (
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: VIOLET }} />
              ) : s === 'active' ? (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin"
                  style={{ color: VIOLET }}
                />
              ) : s === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className={s === 'active' ? 'font-medium' : undefined}>{SEQ_LABELS[k]}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Cela prend généralement moins d'une minute.
      </p>
    </div>
  );
}

/** Indicateur d'étapes pour la génération lancée à la main (sans PDF). */
function AssistantSteps({ phase }: { phase: Exclude<Phase, 'idle'> }) {
  const rows: Array<{ key: Exclude<Phase, 'idle'>; label: string; done: boolean; active: boolean }> = [
    { key: 'analyse', label: 'Lecture de votre matière', done: phase === 'generation', active: phase === 'analyse' },
    { key: 'generation', label: 'Recherche des meilleurs angles', done: false, active: phase === 'generation' },
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
            <Loader2 className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" style={{ color: VIOLET }} />
          ) : (
            <span className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{r.label}</span>
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

  // --- Import PDF ---
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPhase, setPdfPhase] = useState<'idle' | 'upload' | 'extraction' | 'done' | 'error'>('idle');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  // Vrai du début d'un import PDF jusqu'à ce que angles ET images soient prêts.
  const [pdfSequence, setPdfSequence] = useState(false);
  const [seq, setSeq] = useState<SeqState>(SEQ_INITIAL);
  const [editOpen, setEditOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [maxSelectionWarning, setMaxSelectionWarning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  const busy = phase !== 'idle';
  const pdfBusy = pdfSequence;

  // Défilement vers les propositions quand elles s'affichent (fin de séquence ou génération manuelle).
  useEffect(() => {
    if (angles.length > 0 && !pdfSequence && !busy) {
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [angles.length, pdfSequence, busy]);

  const setSeqStep = (key: SeqKey, status: SeqStatus) =>
    setSeq((prev) => ({ ...prev, [key]: status }));

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

  /* ---------------- Appels à l'assistant ---------------- */

  const call = async (body: Record<string, unknown>) => {
    const headers = await authHeaders();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novelty-ai-draft`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* pas de corps JSON */
    }
    return { res, json };
  };

  /** Un appel, plus un seul nouvel essai automatique sur erreur technique (réseau, 5xx, 429 hors quota). */
  const callWithRetry = async (body: Record<string, unknown>) => {
    const isTransient = (r: { res: Response; json: any } | null) =>
      !r ||
      r.res.status >= 500 ||
      (r.res.status === 429 && r.json?.error !== 'frein_anti_rafale');
    let first: { res: Response; json: any } | null = null;
    try {
      first = await call(body);
    } catch (e) {
      console.error('[novelty-ai] appel impossible', body.action, e);
    }
    if (!isTransient(first)) return first!;
    console.warn('[novelty-ai] nouvel essai automatique', body.action, first?.res.status, first?.json);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return call(body); // si ce second appel lève, l'erreur est gérée par genererAngles
  };

  /** Traduit un échec en état affiché. Retourne l'issue, ou null si la réponse est OK. */
  const outcomeFromFailure = (action: string, res: Response, json: any): Outcome | null => {
    if (res.ok) return null;
    console.error('[novelty-ai] échec', action, res.status, json);
    if (res.status === 400 && json?.error === 'matiere_insuffisante') {
      setConseil(
        json?.question ||
          "Ajoutez un détail concret : ce que votre nouveauté change pour la personne qui la découvre.",
      );
      return 'conseil';
    }
    if (res.status === 429 && json?.error === 'frein_anti_rafale') {
      const min = json?.minutes_avant_reouverture;
      setPause(
        min
          ? `Vous avez généré beaucoup de propositions. Vos crédits reviennent dans ${min} minute${min > 1 ? 's' : ''}.`
          : json?.message || 'Vous avez généré beaucoup de propositions. Revenez dans un moment.',
      );
      return 'pause';
    }
    setErreur("L'assistant n'a pas pu préparer vos angles.");
    return 'erreur';
  };

  /**
   * Génère les angles à partir d'un texte passé en paramètre (jamais lu dans un état
   * potentiellement périmé). Utilisé par la séquence PDF et par le bouton manuel.
   */
  const genererAngles = async (texte: string): Promise<Outcome> => {
    const t = texte.trim();
    if (t.length < 10 || runningRef.current) return 'erreur';
    runningRef.current = true;
    setConseil(null);
    setPause(null);
    setErreur(null);
    setAngles([]);
    setPhase('analyse');

    try {
      const resolvedExhibitorId =
        exhibitorId || (ensureExhibitorId ? await ensureExhibitorId() : null);
      if (!resolvedExhibitorId) {
        setErreur("Impossible d'enregistrer votre entreprise pour le moment.");
        return 'erreur';
      }

      const base: Record<string, unknown> = {
        exhibitor_id: resolvedExhibitorId,
        event_id: eventId,
        texte: t,
        ...(currentType ? { type: currentType } : {}),
      };

      const { res: r1, json: analyse } = await callWithRetry({ action: 'analyser', ...base });
      const f1 = outcomeFromFailure('analyser', r1, analyse);
      if (f1) return f1;

      if (analyse?.suffisant === false) {
        setConseil(analyse?.question || "Il me manque un élément pour aller plus loin.");
        return 'conseil';
      }

      setPhase('generation');
      const { res: r2, json: gen } = await callWithRetry({ action: 'generer', ...base, analyse });
      const f2 = outcomeFromFailure('generer', r2, gen);
      if (f2) return f2;

      const list: NoveltyAngle[] = Array.isArray(gen?.angles) ? gen.angles : [];
      if (list.length === 0) {
        setErreur("L'assistant n'a pas trouvé d'angle exploitable. Précisez votre description.");
        return 'erreur';
      }
      setAngles(list);
      return 'ok';
    } catch (e) {
      console.error('[novelty-ai]', e);
      setErreur("L'assistant est momentanément indisponible.");
      return 'erreur';
    } finally {
      setPhase('idle');
      runningRef.current = false;
    }
  };

  const lancerManuel = async () => {
    const outcome = await genererAngles(matiere);
    if (outcome === 'conseil') setEditOpen(true);
  };

  /* ---------------- Séquence PDF : lecture -> (angles || images) -> résultat ---------------- */

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
    setConseil(null);
    setPause(null);
    setErreur(null);
    setAngles([]);
    setCandidates([]);
    setEditOpen(false);
    setMatiere('');
    setPdfFile(file);
    setSeq({ lecture: 'active', angles: 'pending', images: 'pending' });
    setPdfSequence(true);

    try {
      /* 1. Lecture du PDF */
      setPdfPhase('upload');
      const path = `pdf-import/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from('novelty-resources').upload(path, file, {
        contentType: 'application/pdf',
      });
      if (up.error) throw new Error(up.error.message);

      setPdfPhase('extraction');
      const headers = await authHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novelty-pdf-extract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ storage_path: path, exhibitor_id: exhibitorId, event_id: eventId }),
      });
      const json: any = await res.json().catch(() => null);
      const documentId = json?.document_id;
      if (!res.ok || !documentId) throw new Error(json?.error || 'extraction_failed');

      const { data: docRow } = await supabase
        .from('novelty_source_documents')
        .select('extracted_text, image_candidate_count, status')
        .eq('id', documentId)
        .single();

      const text = (docRow?.extracted_text || '').trim();
      setSeqStep('lecture', 'done');
      onApplyBrochure?.(file);

      /* 2a. Angles : démarrent dès que le texte est lu */
      let anglesPromise: Promise<Outcome | 'skipped'>;
      if (text.length >= 10) {
        setMatiere(text);
        setSeqStep('angles', 'active');
        anglesPromise = genererAngles(text).then((outcome) => {
          setSeqStep('angles', outcome === 'ok' ? 'done' : 'error');
          if (outcome === 'conseil') setEditOpen(true);
          return outcome;
        });
      } else {
        setMatiere(text);
        setPdfNotice(
          "Ce PDF ne contient pas de texte exploitable. Décrivez votre nouveauté dans la zone ci-dessous, ou importez un autre PDF.",
        );
        setEditOpen(true);
        setSeqStep('angles', 'skipped');
        anglesPromise = Promise.resolve('skipped');
      }

      /* 2b. Images : tri et sélection, en parallèle des angles */
      setSeqStep('images', 'active');
      const imagesPromise = (async () => {
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

        const signed = await Promise.all(
          (rows || []).map(async (row: any) => {
            const { data } = await supabase.storage
              .from(row.storage_bucket)
              .createSignedUrl(row.storage_path, 3600);
            if (!data?.signedUrl) return null;
            return {
              id: row.id,
              url: data.signedUrl,
              kind: row.kind || 'unknown',
              width: row.width,
              height: row.height,
              selected: !!row.selected,
            } as Candidate;
          }),
        );
        const list = signed.filter((c): c is Candidate => c !== null);
        setCandidates(list);
        void pushSelection(list);
        setSeqStep('images', 'done');
      })().catch((e) => {
        console.error('[novelty-pdf] images', e);
        setSeqStep('images', 'error');
      });

      /* 3. Résultat : tout s'affiche ensemble */
      await Promise.all([anglesPromise, imagesPromise]);
      setPdfPhase('done');
    } catch (e) {
      console.error('[novelty-pdf]', e);
      setPdfError("Le PDF n'a pas pu être traité. Vous pouvez décrire votre nouveauté à la main.");
      setPdfPhase('error');
      setPdfFile(null);
    } finally {
      setPdfSequence(false);
    }
  };

  const resetPdf = () => {
    setPdfFile(null);
    setCandidates([]);
    setPdfPhase('idle');
    setPdfError(null);
    setPdfNotice(null);
    setEditOpen(false);
    setSeq(SEQ_INITIAL);
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

  const appliquer = (angle: NoveltyAngle) => {
    if (canvasHasContent) {
      const ok = window.confirm('Remplacer votre texte actuel par cet angle ?');
      if (!ok) return;
    }
    onApplyAngle(angle);
  };

  /* ---------------- Rendu ---------------- */

  const pdfMode = !!pdfFile; // un PDF a été importé avec succès (ou est en cours)
  const canRegenerate = matiere.trim().length >= 10 && !busy && !pdfBusy;
  const selectedCandidates = candidates.filter((c) => c.selected);

  const openFilePicker = () => {
    if (!pdfBusy && !busy) fileInputRef.current?.click();
  };

  const matiereZone = (
    <div className="space-y-2">
      <Textarea
        value={matiere}
        onChange={(e) => setMatiere(e.target.value)}
        disabled={busy}
        rows={5}
        placeholder="Décrivez votre nouveauté en vrac"
        className="resize-y bg-background text-sm"
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        L'assistant ne remplace pas vos mots, il révèle pourquoi votre nouveauté mérite une visite.
      </p>
      <Button
        type="button"
        onClick={lancerManuel}
        disabled={!canRegenerate}
        className="w-full text-white hover:opacity-90"
        style={{ backgroundColor: VIOLET }}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
        {angles.length > 0 ? 'Régénérer les angles' : 'Trouver les meilleurs angles'}
      </Button>
    </div>
  );

  const dropzone = (
    <div
      role="button"
      tabIndex={0}
      onClick={openFilePicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openFilePicker();
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
        if (f && !pdfBusy && !busy) handlePdf(f);
      }}
      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-colors"
      style={{ borderColor: VIOLET, backgroundColor: dragOver ? `${VIOLET}1f` : 'transparent' }}
    >
      <FileUp className="h-4 w-4" style={{ color: VIOLET }} />
      <p className="mt-1.5 text-xs font-medium" style={{ color: VIOLET }}>
        Ou importez un PDF (plaquette, présentation) et on s'occupe du reste
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">PDF uniquement, 20 Mo maximum</p>
    </div>
  );

  const retryButton = canRegenerate ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={lancerManuel}
      className="mt-2 w-full"
      style={{ borderColor: VIOLET, color: VIOLET }}
    >
      <RefreshCw className="mr-2 h-3.5 w-3.5" />
      Relancer
    </Button>
  ) : null;

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
            Décrivez votre nouveauté en vrac ou importez un PDF : l'assistant vous propose des
            angles qui donnent envie de venir la voir.
          </p>
        </div>
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

      {/* ── Séquence PDF en cours : un seul bloc d'attente ── */}
      {pdfSequence && <SequenceBlock seq={seq} fileName={pdfFile?.name ?? null} />}

      {!pdfSequence && (
        <>
          {/* Saisie manuelle (aucun PDF importé) */}
          {!pdfMode && (
            <>
              <div className="mt-4">{matiereZone}</div>
              <div className="mt-4">{dropzone}</div>
            </>
          )}

          {/* Génération manuelle en cours */}
          {busy && (
            <div
              className="mt-4 rounded-lg border bg-background/70 p-3"
              style={{ borderColor: `${VIOLET}33` }}
            >
              <AssistantSteps phase={phase as Exclude<Phase, 'idle'>} />
            </div>
          )}

          {/* Messages */}
          {pdfError && (
            <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              {pdfError}
            </p>
          )}
          {pdfNotice && (
            <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              {pdfNotice}
            </p>
          )}
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
              {pdfMode && (
                <p className="mt-1 text-muted-foreground">
                  Complétez le texte ci-dessous puis relancez.
                </p>
              )}
            </div>
          )}
          {pause && !busy && (
            <div className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              <p>{pause}</p>
              {retryButton}
            </div>
          )}
          {erreur && !busy && (
            <div className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              <p>{erreur}</p>
              {retryButton}
            </div>
          )}

          {/* Propositions */}
          {angles.length > 0 && !busy && (
            <div ref={resultsRef} className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: VIOLET }}>
                {angles.length} angle{angles.length > 1 ? 's' : ''} proposé
                {angles.length > 1 ? 's' : ''}
              </h3>

              {selectedCandidates.length > 0 && (
                <div className="rounded-lg border bg-background p-2" style={{ borderColor: `${VIOLET}33` }}>
                  <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      Images retenues pour votre nouveauté
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                      className="text-[11px] font-medium underline-offset-2 hover:underline"
                      style={{ color: VIOLET }}
                    >
                      Changer
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {selectedCandidates.slice(0, 3).map((c) => (
                      <img
                        key={c.id}
                        src={c.url}
                        alt={KIND_LABELS[c.kind] || 'Image extraite du PDF'}
                        className="h-16 w-full rounded object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

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
                      style={{ borderColor: VIOLET, backgroundColor: `${VIOLET}0f`, color: VIOLET }}
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

          {/* Galerie d'images issues du PDF */}
          {pdfMode && pdfPhase === 'done' && candidates.length === 0 && seq.images !== 'error' && (
            <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              Aucune image exploitable trouvée dans ce PDF. Vous pourrez ajouter vos propres images
              dans le canevas.
            </p>
          )}
          {pdfMode && seq.images === 'error' && (
            <p className="mt-4 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              Les images du PDF n'ont pas pu être récupérées. Vous pourrez ajouter vos propres images
              dans le canevas.
            </p>
          )}
          {candidates.length > 0 && (
            <div ref={galleryRef} className="mt-5">
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

          {/* Après un PDF : texte extrait repliable, et import d'un autre PDF */}
          {pdfMode && (
            <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: `${VIOLET}26` }}>
              <button
                type="button"
                onClick={() => setEditOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: VIOLET }}
                aria-expanded={editOpen}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${editOpen ? 'rotate-180' : ''}`}
                />
                Modifier le texte extrait et relancer
              </button>
              {editOpen && matiereZone}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  <span className="truncate">{pdfFile?.name}</span>
                  <X
                    className="h-3 w-3 shrink-0 cursor-pointer"
                    aria-label="Retirer le PDF"
                    onClick={resetPdf}
                  />
                </span>
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="shrink-0 text-[11px] font-medium underline-offset-2 hover:underline"
                  style={{ color: VIOLET }}
                >
                  Importer un autre PDF
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
