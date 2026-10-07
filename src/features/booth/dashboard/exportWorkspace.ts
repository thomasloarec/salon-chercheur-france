import { exportWorkspace, type BoothExport, type BoothExportRow } from '@/lib/booth/rpc';
import { ACTION, HORIZON, POTENTIAL, RELATIONSHIP, TOPIC, VALUE_BAND } from '../salon/labels';

const SOURCE: Record<string, string> = { manual: 'Saisie', card: 'Carte', search: 'Recherche', qr: 'QR code', voice: 'Voix' };
const PROJECT_STATUS: Record<string, string> = { open: 'En cours', won: 'Gagné', lost: 'Perdu', abandoned: 'Abandonné' };

const lab = (map: Record<string, string>, v: string | null | undefined) => (v ? map[v] ?? v : '');
export function frDate(v: string | null | undefined) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
const num = (v: number | null | undefined) => (typeof v === 'number' ? v : '');

export const MEETING_HEADERS = [
  'Jour', 'Date', 'Heure', 'Entreprise', 'Prénom', 'Nom', 'Poste', 'Email', 'Téléphone', 'LinkedIn', 'Relation',
  'Sujet client', 'Potentiel', 'Action', 'Échéance', 'Action faite le', "Responsable de l'action", 'Suivi par', 'Note',
  'Source', 'Projet', 'Tranche', 'Montant', 'Horizon', 'Probabilité', 'Statut du projet', 'Montant gagné', 'Statut',
];

function meetingRow(r: BoothExportRow): (string | number)[] {
  return [
    num(r.day_number), frDate(r.local_date ?? r.occurred_at), r.local_time ?? '', r.company_name ?? '', r.first_name ?? '',
    r.last_name ?? '', r.job_title ?? '', r.email ?? '', r.phone ?? '', r.linkedin_url ?? '', lab(RELATIONSHIP, r.relationship),
    lab(TOPIC, r.customer_topic), lab(POTENTIAL, r.potential), r.next_action === 'none' ? '' : lab(ACTION, r.next_action),
    frDate(r.next_action_due), frDate(r.next_action_done_at), r.next_action_owner ?? '', r.owner ?? '', r.note ?? '',
    lab(SOURCE, r.capture_source), r.project_title ?? '', lab(VALUE_BAND, r.project_value_band), num(r.project_amount),
    lab(HORIZON, r.project_horizon), typeof r.project_probability === 'number' ? `${r.project_probability} %` : '',
    lab(PROJECT_STATUS, r.project_status), num(r.project_won_amount), r.status === 'cancelled' ? 'Annulée' : 'Réalisée',
  ];
}

const PROJECT_HEADERS = [
  'Créé le', 'Projet', 'Entreprise', 'Prénom', 'Nom', 'Tranche', 'Montant', 'Devise', 'Horizon', 'Probabilité',
  'Statut', 'Montant gagné', 'Gagné le', 'Perdu le', 'Suivi par',
];

export function fileBase(name: string, date = new Date()) {
  const clean = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `Lotexpo_Leads_${clean || 'Salon'}_${ymd}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function runExport(workspaceId: string, salonName: string, kind: 'xlsx' | 'csv'): Promise<BoothExport> {
  const data = await exportWorkspace(workspaceId);
  const rows = (data.rows ?? []).map(meetingRow);
  const base = fileBase(salonName);
  if (kind === 'csv') {
    const text = [MEETING_HEADERS, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
    download(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
  } else {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([MEETING_HEADERS, ...rows]), 'Rencontres');
    const projects = (data.projects ?? []).map((p) => [
      frDate(p.created_at), p.title ?? '', p.company_name ?? '', p.first_name ?? '', p.last_name ?? '',
      lab(VALUE_BAND, p.value_band), num(p.amount), p.currency ?? '', lab(HORIZON, p.horizon),
      typeof p.probability === 'number' ? `${p.probability} %` : '', lab(PROJECT_STATUS, p.status), num(p.won_amount),
      frDate(p.won_at), frDate(p.lost_at), p.owner ?? '',
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([PROJECT_HEADERS, ...projects]), 'Projets');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`);
  }
  return data;
}
