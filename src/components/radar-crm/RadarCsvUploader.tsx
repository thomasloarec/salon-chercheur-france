import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

interface Props {
  onParsed: (parsed: ParsedFile) => void;
}

const MAX_ROWS = 5000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const RadarCsvUploader: React.FC<Props> = ({ onParsed }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Format non supporté. Importez un fichier .csv (Excel bientôt disponible).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Fichier trop volumineux (max 8 Mo).');
      return;
    }
    setLoading(true);
    void trackRadarEvent('csv_upload_started', { size: file.size, name: file.name });

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      complete: (results) => {
        setLoading(false);
        if (results.errors && results.errors.length > 0) {
          console.warn('CSV parse errors', results.errors);
        }
        const rows = (results.data || []).filter(
          (r) => r && typeof r === 'object' && Object.values(r).some((v) => v != null && String(v).trim() !== ''),
        );
        if (rows.length === 0) {
          setError('Aucune ligne lisible dans ce fichier.');
          return;
        }
        if (rows.length > MAX_ROWS) {
          setError(`Trop de lignes (${rows.length}). Limite : ${MAX_ROWS}.`);
          return;
        }
        const headers = (results.meta.fields || []).filter(Boolean);
        if (headers.length === 0) {
          setError('Aucune colonne détectée. Vérifiez que la première ligne contient les en-têtes.');
          return;
        }
        void trackRadarEvent('csv_parsed', { rows: rows.length, columns: headers.length });
        onParsed({ fileName: file.name, headers, rows });
      },
      error: (err) => {
        setLoading(false);
        setError(`Erreur de lecture du fichier : ${err.message}`);
      },
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFiles(f);
        }}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-foreground font-medium mb-1">
          Glissez-déposez votre fichier CSV ici
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Format CSV uniquement — Excel bientôt disponible — max {MAX_ROWS.toLocaleString('fr-FR')} lignes
        </p>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          variant="default"
        >
          <Upload className="mr-2 h-4 w-4" />
          {loading ? 'Lecture…' : 'Importer mon fichier CSV'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFiles(f);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default RadarCsvUploader;
