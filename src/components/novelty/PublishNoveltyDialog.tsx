import React, { useRef } from 'react';
import { CheckCircle2, Circle, FileText, Loader2, RefreshCw, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------
 * Popup unique de publication d'une Nouveauté.
 * 4 états : document -> publishing -> success | error.
 * Composant de présentation : toute la logique vit dans AtelierNouveaute.
 * ------------------------------------------------------------------ */

export type PublishPhase = 'closed' | 'document' | 'publishing' | 'success' | 'error';

export type PublishStepStatus = 'pending' | 'active' | 'done';

export interface PublishStep {
  key: string;
  label: string;
  status: PublishStepStatus;
  detail?: string | null;
}

export interface PublishError {
  title: string;
  description: string;
  retryable: boolean;
}

interface PublishNoveltyDialogProps {
  phase: PublishPhase;
  steps: PublishStep[];
  error: PublishError | null;
  pdfError: string | null;
  /** Fichier PDF choisi depuis la popup (validation faite par le parent). */
  onPdfSelected: (file: File) => void;
  onPublishWithoutPdf: () => void;
  /** Fermeture depuis l'état « document » (Échap). */
  onCancelDocument: () => void;
  onRetry: () => void;
  onBackToEdit: () => void;
  onSuccessAck: () => void;
}

const BRAND_BUTTON = 'bg-[#6b51ff] text-white hover:bg-[#5b43e6]';

function StepIcon({ status }: { status: PublishStepStatus }) {
  if (status === 'done') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />;
  }
  if (status === 'active') {
    return (
      <Loader2
        className="h-4 w-4 shrink-0 text-[#6b51ff] motion-safe:animate-spin"
        aria-hidden="true"
      />
    );
  }
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />;
}

export default function PublishNoveltyDialog({
  phase,
  steps,
  error,
  pdfError,
  onPdfSelected,
  onPublishWithoutPdf,
  onCancelDocument,
  onRetry,
  onBackToEdit,
  onSuccessAck,
}: PublishNoveltyDialogProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const open = phase !== 'closed';
  const activeStep = steps.find((s) => s.status === 'active');

  // Échap / fermeture : autorisée uniquement pour « document » et « error ».
  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (phase === 'document') onCancelDocument();
    else if (phase === 'error') onBackToEdit();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (phase === 'publishing' || phase === 'success') e.preventDefault();
        }}
        className="sm:max-w-md"
      >
        {/* Sélecteur de fichier DANS la popup : le clic reste un geste utilisateur direct. */}
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (f) onPdfSelected(f);
          }}
        />

        {/* ── État 1 : document à télécharger ── */}
        {phase === 'document' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Publier sans document à télécharger ?</AlertDialogTitle>
              <AlertDialogDescription>
                Vous êtes sur le point de publier sans document téléchargeable. Chaque visiteur qui
                télécharge votre brochure devient un contact que vous pouvez recontacter avant le
                salon. Sans document, vous vous privez de ce canal de prise de contact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {pdfError && (
              <p role="alert" className="text-sm text-destructive">
                {pdfError}
              </p>
            )}
            <AlertDialogFooter className="sm:justify-between">
              <Button variant="ghost" className="text-muted-foreground" onClick={onPublishWithoutPdf}>
                Publier sans document
              </Button>
              <Button className={BRAND_BUTTON} onClick={() => pdfInputRef.current?.click()}>
                Importer un PDF
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {/* ── État 2 : publication en cours (bloquant) ── */}
        {phase === 'publishing' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Publication de votre nouveauté</AlertDialogTitle>
              <AlertDialogDescription>
                Ne fermez pas cette page, cela ne prend généralement que quelques instants.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ol className="space-y-2.5 py-1">
              {steps.map((s) => (
                <li
                  key={s.key}
                  className={cn(
                    'flex items-start gap-2.5 text-sm',
                    s.status === 'pending' && 'text-muted-foreground',
                    s.status === 'active' && 'font-medium text-foreground',
                  )}
                >
                  <span className="mt-0.5">
                    <StepIcon status={s.status} />
                  </span>
                  <span className="min-w-0">
                    {s.label}
                    {s.detail && (
                      <span className="ml-1.5 font-normal text-muted-foreground">{s.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="sr-only" aria-live="polite">
              {activeStep ? `${activeStep.label} ${activeStep.detail ?? ''}` : ''}
            </p>
          </>
        )}

        {/* ── État 3 : succès ── */}
        {phase === 'success' && (
          <>
            <div className="flex justify-center pt-2">
              <CheckCircle2
                className="h-10 w-10 text-emerald-600 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300"
                aria-hidden="true"
              />
            </div>
            <AlertDialogHeader className="sm:text-center">
              <AlertDialogTitle className="text-center">
                Votre nouveauté a bien été transmise
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Elle va être examinée par l'équipe Lotexpo sous 24 h avant sa mise en ligne.
                Vous serez informé dès qu'elle sera publiée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <Button className={BRAND_BUTTON} onClick={onSuccessAck} autoFocus>
                Compris
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {/* ── État 4 : erreur ── */}
        {phase === 'error' && error && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                {error.title}
              </AlertDialogTitle>
              <AlertDialogDescription>{error.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Votre nouveauté est intacte, rien n'a été perdu.
            </p>
            <AlertDialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={onBackToEdit}>
                Revenir à ma nouveauté
              </Button>
              {error.retryable && (
                <Button className={BRAND_BUTTON} onClick={onRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Réessayer
                </Button>
              )}
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
