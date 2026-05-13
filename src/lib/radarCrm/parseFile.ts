import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type CrmSourceType = 'csv' | 'excel';

export interface ParsedCrmFile {
  fileName: string;
  sourceType: CrmSourceType;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  sheetName?: string;
  availableSheets?: string[];
}

export const MAX_ROWS = 5000;
export const MAX_BYTES = 8 * 1024 * 1024;

const cleanRows = (rows: Array<Record<string, unknown>>) =>
  rows.filter(
    (r) => r && typeof r === 'object' &&
      Object.values(r).some((v) => v != null && String(v).trim() !== ''),
  );

const cleanHeaders = (headers: unknown[]) =>
  headers
    .map((h) => (h == null ? '' : String(h).trim()))
    .filter((h) => h.length > 0);

function detectType(fileName: string): CrmSourceType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel';
  return null;
}

function parseCsv(file: File): Promise<ParsedCrmFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      complete: (results) => {
        const rows = cleanRows((results.data || []) as Array<Record<string, unknown>>);
        const headers = cleanHeaders(results.meta.fields || []);
        if (headers.length === 0) {
          reject(new Error('Aucune colonne détectée. Vérifiez que la première ligne contient les en-têtes.'));
          return;
        }
        if (rows.length === 0) {
          reject(new Error('Aucune ligne lisible dans ce fichier.'));
          return;
        }
        resolve({ fileName: file.name, sourceType: 'csv', headers, rows });
      },
      error: (err) => reject(new Error(`Erreur de lecture du fichier : ${err.message}`)),
    });
  });
}

function pickFirstNonEmptySheet(wb: XLSX.WorkBook): string {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    if (cleanRows(data).length > 0) return name;
  }
  return wb.SheetNames[0];
}

async function parseExcel(file: File, requestedSheet?: string): Promise<ParsedCrmFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  if (!wb.SheetNames.length) {
    throw new Error('Aucune donnée exploitable n’a été détectée dans ce fichier Excel.');
  }
  const sheetName = requestedSheet && wb.SheetNames.includes(requestedSheet)
    ? requestedSheet
    : pickFirstNonEmptySheet(wb);
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  const rows = cleanRows(data);
  if (rows.length === 0) {
    throw new Error('Aucune donnée exploitable n’a été détectée dans ce fichier Excel.');
  }
  // Build headers: union of keys from header row (row 1) - sheet_to_json uses first row as keys
  const headerSet = new Set<string>();
  for (const r of rows) Object.keys(r).forEach((k) => headerSet.add(k));
  const headers = cleanHeaders(Array.from(headerSet));
  if (headers.length === 0) {
    throw new Error('Aucune colonne détectée. Vérifiez que la première ligne contient les en-têtes.');
  }
  // Trim header keys in rows
  const normalizedRows = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const trimmed = String(k).trim();
      if (trimmed.length === 0) continue;
      out[trimmed] = v;
    }
    return out;
  });
  return {
    fileName: file.name,
    sourceType: 'excel',
    headers,
    rows: normalizedRows,
    sheetName,
    availableSheets: wb.SheetNames,
  };
}

export async function parseCrmFile(file: File, sheetName?: string): Promise<ParsedCrmFile> {
  if (file.size > MAX_BYTES) {
    throw new Error('Fichier trop volumineux (max 8 Mo).');
  }
  const type = detectType(file.name);
  if (!type) {
    throw new Error('Format non supporté. Importez un fichier CSV ou Excel (.xlsx).');
  }
  const parsed = type === 'csv' ? await parseCsv(file) : await parseExcel(file, sheetName);
  if (parsed.rows.length > MAX_ROWS) {
    throw new Error(`Le fichier contient trop de lignes pour la Beta. Limite actuelle : ${MAX_ROWS}.`);
  }
  return parsed;
}

export async function reparseExcelSheet(file: File, sheetName: string) {
  return parseExcel(file, sheetName);
}
