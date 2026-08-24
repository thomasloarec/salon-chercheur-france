import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { FileUp, Loader2, CheckCircle2, AlertTriangle, Clock, Calendar } from 'lucide-react';

type Phase = 'select' | 'extracting' | 'preview' | 'applying' | 'error';

interface ImportResult {
  champs_detectes?: string[];
  champs_non_detectes?: string[];
  speakers?: any[];
  sessions?: any[];
}

const CHAMP_LABELS: Record<string, string> = {
  titres: 'titres', jours: 'jours', horaires: 'horaires', salles: 'salles',
  thematiques: 'thématiques', intervenants: 'intervenants', fonctions: 'fonctions',
  entreprises: 'entreprises', descriptions: 'descriptions', roles: 'rôles',
};
const champLabel = (c: string) => CHAMP_LABELS[c] ?? c;
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : null);

const ProgramPdfImportDialog: React.FC<{
  eventId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}> = ({ eventId, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('select');
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = () => {
    setPhase('select'); setFile(null); setImportId(null); setResult(null); setErrorMsg(null);
  };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const pickFile = (f?: File | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Choisissez un fichier PDF.'); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error('PDF trop volumineux (20 Mo maximum).'); return; }
    setFile(f);
  };

  const runExtraction = async () => {
    if (!file) return;
    setPhase('extracting'); setErrorMsg(null);
    try {
      const path = `${eventId}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from('program-imports').upload(path, file, { contentType: 'application/pdf' });
      if (up.error) throw new Error("L'envoi du PDF a échoué.");

      const { data: res, error } = await supabase.functions.invoke('program-pdf-extract', {
        body: { event_id: eventId, pdf_path: path, original_filename: file.name },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.message || res.error);

      const id = res.import_id as string;
      setImportId(id);

      const { data: imp, error: impErr } = await supabase.rpc('get_program_import_admin', { p_import_id: id });
      if (impErr) throw impErr;
      const row = Array.isArray(imp) ? imp[0] : imp;
      if (!row?.result) throw new Error('Aperçu indisponible.');
      setResult(row.result as ImportResult);
      setPhase('preview');
    } catch (e: any) {
      setErrorMsg(e?.message || "L'extraction a échoué.");
      setPhase('error');
    }
  };

  const apply = async () => {
    if (!importId) return;
    setPhase('applying');
    try {
      const { data, error } = await supabase.rpc('apply_program_import', { p_import_id: importId });
      if (error) throw error;
      const r = data as any;
      queryClient.invalidateQueries({ queryKey: ['event-program-admin', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-program', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-program-count', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-speakers-admin', eventId] });
      toast.success(`${r?.sessions ?? 0} session(s) créée(s) en brouillon.`);
      close();
    } catch (e: any) {
      setErrorMsg(e?.message || "L'application a échoué.");
      setPhase('error');
    }
  };

  const sessions = result?.sessions ?? [];
  const speakers = result?.speakers ?? [];
  const detectes = result?.champs_detectes ?? [];
  const nonDetectes = result?.champs_non_detectes ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer un programme depuis un PDF</DialogTitle>
          <DialogDescription>
            L'IA extrait les sessions et intervenants du PDF sans rien inventer. Vous validez avant toute création.
          </DialogDescription>
        </DialogHeader>

        {phase === 'select' && (
          <div className="space-y-4">
            <input id="pdf-file" type="file" accept="application/pdf" className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])} />
            <label htmlFor="pdf-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center hover:border-primary/40">
              <FileUp className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">{file ? file.name : 'Choisir un fichier PDF'}</span>
              <span className="text-xs text-muted-foreground">Brochure du programme, 20 Mo maximum</span>
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={close}>Annuler</Button>
              <Button onClick={runExtraction} disabled={!file}>Lancer l'extraction</Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'extracting' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Extraction en cours…</p>
            <p className="text-xs text-muted-foreground">L'IA lit le PDF, cela prend généralement moins d'une minute.</p>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border border-border p-3 text-sm">
              <span><strong>{sessions.length}</strong> session{sessions.length > 1 ? 's' : ''}</span>
              <span><strong>{speakers.length}</strong> intervenant{speakers.length > 1 ? 's' : ''}</span>
            </div>

            {detectes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detectes.map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {champLabel(c)}
                  </Badge>
                ))}
              </div>
            )}

            {nonDetectes.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-surface p-3 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Ce PDF ne contenait pas : {nonDetectes.map(champLabel).join(', ')}. Ces champs
                  resteront vides ; vous pourrez les compléter à la main dans l'éditeur.
                </p>
              </div>
            )}

            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {sessions.slice(0, 40).map((s: any, i: number) => (
                <div key={i} className="rounded-md border border-border p-2 text-sm">
                  <p className="font-medium leading-tight">{s.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {s.day_date && (
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{s.day_date}</span>
                    )}
                    {hhmm(s.start_time) && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{hhmm(s.start_time)}</span>
                    )}
                    {Array.isArray(s.speakers) && s.speakers.length > 0 && (
                      <span>{s.speakers.length} intervenant{s.speakers.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              ))}
              {sessions.length > 40 && (
                <p className="py-1 text-center text-xs text-muted-foreground">… et {sessions.length - 40} autres.</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close}>Annuler</Button>
              <Button onClick={apply} disabled={sessions.length === 0}>
                Créer {sessions.length} session{sessions.length > 1 ? 's' : ''} en brouillon
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'applying' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Création des sessions…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p>{errorMsg}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>Fermer</Button>
              <Button onClick={reset}>Recommencer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProgramPdfImportDialog;
