import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import { parseCrmFile, MAX_ROWS, type ParsedCrmFile } from '@/lib/radarCrm/parseFile';

interface Props {
  onParsed: (parsed: ParsedCrmFile) => void;
}

const RadarCsvUploader: React.FC<Props> = ({ onParsed }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (file: File) => {
    setError(null);
    setLoading(true);
    void trackRadarEvent('csv_upload_started', { size: file.size, name: file.name });
    try {
      const parsed = await parseCrmFile(file);
      void trackRadarEvent('csv_parsed', {
        rows: parsed.rows.length,
        columns: parsed.headers.length,
        fileType: parsed.sourceType,
        sheetName: parsed.sheetName,
      });
      onParsed(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de lecture du fichier';
      setError(msg);
    } finally {
      setLoading(false);
    }
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
          Glissez-déposez votre fichier CSV ou Excel ici
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Formats acceptés : CSV, XLSX — max {MAX_ROWS.toLocaleString('fr-FR')} lignes
        </p>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          variant="default"
          className="w-full sm:w-auto max-w-full h-auto whitespace-normal text-center"
        >
          <Upload className="mr-2 h-4 w-4 shrink-0" />
          {loading ? 'Lecture…' : 'Importer mon fichier CSV ou Excel'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
