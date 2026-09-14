import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Upload, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  eventId: string;
  /** Dépôt organisateur existant auquel rattacher le fichier (facultatif). */
  importId?: string;
}

type TargetColumn = 'id_exposant' | 'nom' | 'stand' | 'website';

const HEADER_VARIANTS: Record<TargetColumn, string[]> = {
  id_exposant: ['idexposant', 'id', 'identifiant', 'idlotexpo', 'reference'],
  nom: ['nom', 'nomexposant', 'exposant', 'raisonsociale', 'societe', 'entreprise', 'company', 'name'],
  stand: ['stand', 'standexposant', 'numerostand', 'nstand', 'emplacement', 'booth'],
  website: ['website', 'siteweb', 'site', 'url', 'siteinternet', 'web', 'lien'],
};

const normalizeHeader = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const FLAG_LABELS: Record<string, { label: string; tone: 'neutral' | 'alert' | 'info' }> = {
  ok: { label: 'Lignes exploitables', tone: 'neutral' },
  missing_name: { label: 'Nom manquant', tone: 'alert' },
  missing_website: { label: 'Site web manquant', tone: 'alert' },
  invalid_url: { label: 'Adresse web illisible', tone: 'alert' },
  platform_url: { label: 'Lien de réseau social écarté', tone: 'alert' },
  duplicate_line: { label: 'Doublon dans le fichier', tone: 'alert' },
  bad_id_exposant: { label: 'Identifiant non reconnu', tone: 'alert' },
  id_not_yet_synced: { label: 'Fiche Airtable pas encore synchronisée', tone: 'info' },
};

const toneClass = (tone: 'neutral' | 'alert' | 'info') =>
  tone === 'alert'
    ? 'border-amber-300 bg-amber-50 text-amber-800'
    : tone === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-border bg-muted text-foreground';

const PAGE_SIZE = 50;

const OrganizerImportUpload: React.FC<Props> = ({ eventId, importId }) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [result, setResult] = useState<{
    import_id: string;
    stats: { total: number; par_flag: Record<string, number> };
    file_name: string;
  } | null>(null);
  const [page, setPage] = useState(0);

  const activeImportId = result?.import_id ?? null;

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ['staging-organizer-exhibitors', activeImportId],
    enabled: !!activeImportId,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('staging_organizer_exhibitors')
        .select('line_no, raw_nom, raw_stand, raw_website, domain_full, domain_registrable, parse_flag, match_reason')
        .eq('import_id', activeImportId as string)
        .order('line_no', { ascending: true });
      if (err) throw err;
      return data ?? [];
    },
  });

  const pagedRows = useMemo(() => {
    if (!rows) return [];
    return rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  }, [rows, page]);

  const totalPages = rows ? Math.ceil(rows.length / PAGE_SIZE) : 0;

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });

      if (!matrix.length) {
        setError('Le fichier ne contient aucune ligne.');
        return;
      }

      const headerRow = matrix[0] as unknown[];
      const normalized = headerRow.map(normalizeHeader);
      const indexOf = (target: TargetColumn) =>
        normalized.findIndex((h) => h && HEADER_VARIANTS[target].includes(h));

      const idx = {
        id_exposant: indexOf('id_exposant'),
        nom: indexOf('nom'),
        stand: indexOf('stand'),
        website: indexOf('website'),
      };

      if (idx.nom === -1 || idx.website === -1) {
        const found = headerRow
          .map((h) => String(h ?? '').trim())
          .filter(Boolean)
          .join(' · ');
        const missing = [idx.nom === -1 ? 'nom' : null, idx.website === -1 ? 'website' : null]
          .filter(Boolean)
          .join(' et ');
        setError(
          `Colonne ${missing} introuvable. En-têtes lus dans la première ligne : ${found || '(aucun)'}.`,
        );
        return;
      }

      const cell = (row: unknown[], i: number) => {
        if (i === -1) return undefined;
        const v = row?.[i];
        if (v === undefined || v === null) return undefined;
        const s = String(v);
        return s.length ? s : undefined;
      };

      const payloadRows = matrix.slice(1).map((row, i) => ({
        line_no: i + 1,
        nom: cell(row as unknown[], idx.nom),
        stand: cell(row as unknown[], idx.stand),
        website: cell(row as unknown[], idx.website),
        id_exposant: cell(row as unknown[], idx.id_exposant),
      }));

      if (!payloadRows.length) {
        setError('Le fichier ne contient aucune ligne de données sous les en-têtes.');
        return;
      }

      const body: Record<string, unknown> = {
        file_name: file.name,
        rows: payloadRows,
      };
      if (importId) body.import_id = importId;
      else body.event_id = eventId;

      const { data, error: fnError } = await supabase.functions.invoke('organizer-import-parse', {
        body,
      });

      if (fnError) {
        const ctx: any = (fnError as any)?.context;
        let payload: any = null;
        try {
          payload = typeof ctx?.json === 'function' ? await ctx.json() : null;
        } catch {
          payload = null;
        }
        if (payload?.code === 'ALREADY_APPLIED' || ctx?.status === 409) {
          setAlreadyApplied(true);
          setError('Cet import a déjà été appliqué, il ne peut plus être modifié');
          return;
        }
        throw new Error(payload?.error || fnError.message || 'Préparation impossible.');
      }

      const res = data as any;
      if (!res?.success) {
        if (res?.code === 'ALREADY_APPLIED') {
          setAlreadyApplied(true);
          setError('Cet import a déjà été appliqué, il ne peut plus être modifié');
          return;
        }
        throw new Error(res?.error || 'Préparation impossible.');
      }

      setPage(0);
      setResult({ import_id: res.import_id, stats: res.stats, file_name: file.name });
      toast({ title: 'Fichier préparé', description: `${res.stats?.total ?? 0} ligne(s) lues.` });
    } catch (err: any) {
      setError(err?.message || 'Lecture du fichier impossible.');
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const statEntries = result
    ? Object.entries(result.stats?.par_flag ?? {}).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
        <p className="font-medium flex items-center gap-2">
          <Info className="h-4 w-4" />
          Format attendu
        </p>
        <p className="text-muted-foreground">
          Un fichier Excel (.xlsx) ou CSV, une feuille, une ligne par exposant, avec ces colonnes en
          première ligne : <strong>nom</strong> (obligatoire), <strong>website</strong> (obligatoire),{' '}
          <strong>stand</strong> (facultatif), <strong>id_exposant</strong> (facultatif).
        </p>
        <p className="text-muted-foreground">
          Les adresses web peuvent être écrites librement : <code>entreprise.com</code>,{' '}
          <code>www.entreprise.com</code>, <code>https://entreprise.com/contact</code> sont toutes
          acceptées et harmonisées automatiquement.
        </p>
        <p className="text-muted-foreground">
          Indiquez l'adresse du site de l'entreprise elle-même. Les pages de réseaux sociaux
          (LinkedIn, Facebook, Instagram) ne sont pas retenues.
        </p>
        <p className="text-muted-foreground">
          Les colonnes en plus sont ignorées. Si un exposant n'a pas de site web, laissez la cellule
          vide : la ligne sera signalée pour traitement manuel.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={parsing || alreadyApplied}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {result ? 'Remplacer par un nouveau fichier' : 'Choisir un fichier'}
        </Button>
        {result && (
          <span className="text-xs text-muted-foreground truncate">{result.file_name}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-border bg-muted text-foreground">
              Total : {result.stats?.total ?? 0}
            </Badge>
            {statEntries.map(([flag, count]) => {
              const meta = FLAG_LABELS[flag] ?? { label: flag, tone: 'neutral' as const };
              return (
                <Badge key={flag} variant="outline" className={toneClass(meta.tone)}>
                  {meta.label} : {count}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Aucune donnée du site n'a été modifiée. Cette étape ne fait que préparer le rapprochement.
          </p>

          {rowsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : rows && rows.length > 0 ? (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium">Ligne</th>
                      <th className="px-2 py-2 font-medium">Nom</th>
                      <th className="px-2 py-2 font-medium">Stand</th>
                      <th className="px-2 py-2 font-medium">Site web</th>
                      <th className="px-2 py-2 font-medium">Domaine</th>
                      <th className="px-2 py-2 font-medium">Domaine racine</th>
                      <th className="px-2 py-2 font-medium">Statut</th>
                      <th className="px-2 py-2 font-medium">Détail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((r: any) => (
                      <tr
                        key={`${r.line_no}-${r.raw_nom ?? ''}`}
                        className={`border-t ${r.parse_flag !== 'ok' ? 'bg-amber-50/70' : ''}`}
                      >
                        <td className="px-2 py-1.5">{r.line_no}</td>
                        <td className="px-2 py-1.5">{r.raw_nom || '—'}</td>
                        <td className="px-2 py-1.5">{r.raw_stand || '—'}</td>
                        <td className="px-2 py-1.5 max-w-[180px] truncate">{r.raw_website || '—'}</td>
                        <td className="px-2 py-1.5">{r.domain_full || '—'}</td>
                        <td className="px-2 py-1.5">{r.domain_registrable || '—'}</td>
                        <td className="px-2 py-1.5">
                          {FLAG_LABELS[r.parse_flag]?.label ?? r.parse_flag}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.match_reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {page + 1} sur {totalPages} · {rows.length} lignes
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Précédent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune ligne préparée pour cet import.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default OrganizerImportUpload;
