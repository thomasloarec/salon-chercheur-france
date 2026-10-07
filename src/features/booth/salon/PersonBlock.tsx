import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { searchCompanies, type BoothCompanySearchItem } from '@/lib/booth/rpc';
import type { Contact } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';
import { enqueue } from '../sync/engine';
import { isValidEmail } from './display';

const FIELDS = ['first_name', 'last_name', 'company_name', 'job_title', 'email', 'phone', 'linkedin_url'] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string> & { company_domain: string | null; lotexpo_company_ref: string | null };

const toForm = (c: Contact): Form => ({
  first_name: c.first_name ?? '',
  last_name: c.last_name ?? '',
  company_name: c.company_name ?? '',
  job_title: c.job_title ?? '',
  email: c.email ?? '',
  phone: c.phone ?? '',
  linkedin_url: c.linkedin_url ?? '',
  company_domain: c.company_domain,
  lotexpo_company_ref: c.lotexpo_company_ref,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value || <span className="font-normal text-muted-foreground">Non renseigné</span>}</span>
    </div>
  );
}

export default function PersonBlock({ cache, me, contact: c, canEdit }: { cache: BoothCache; me: string; contact: Contact; canEdit: boolean }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(() => toForm(c));
  const [err, setErr] = useState<string | null>(null);
  const [companies, setCompanies] = useState<BoothCompanySearchItem[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');

  // Logo de l'entreprise Lotexpo liée (en ligne seulement).
  useEffect(() => {
    setLogo(null);
    if (!c.lotexpo_company_ref || !c.company_name || !navigator.onLine) return;
    let off = false;
    searchCompanies(c.company_name, 5)
      .then((r) => {
        if (!off) setLogo(r.items?.find((x) => x.public_identity_id === c.lotexpo_company_ref)?.logo_url ?? null);
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [c.lotexpo_company_ref, c.company_name]);

  useEffect(() => {
    const q = companyQuery.trim();
    if (q.length < 2 || !navigator.onLine) {
      setCompanies([]);
      return;
    }
    let off = false;
    const t = setTimeout(() => {
      searchCompanies(q, 6)
        .then((r) => !off && setCompanies(r.items ?? []))
        .catch(() => !off && setCompanies([]));
    }, 300);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [companyQuery]);

  const startEdit = () => {
    setF(toForm(c));
    setErr(null);
    setCompanies([]);
    setCompanyQuery('');
    setOpen(true);
  };

  const save = async () => {
    const t = (k: Field) => f[k].trim();
    if (!t('first_name') && !t('last_name') && !t('company_name') && !t('email') && !t('phone')) {
      setErr('Indiquez au moins un nom, une entreprise, un email ou un téléphone.');
      return;
    }
    if (t('email') && !isValidEmail(t('email'))) {
      setErr("L'email n'est pas valide.");
      return;
    }
    const data: Record<string, unknown> = {};
    for (const k of FIELDS) {
      const v = t(k) || null;
      if (v !== (c[k] ?? null)) data[k] = v;
    }
    if (f.company_domain !== c.company_domain) data.company_domain = f.company_domain;
    if (f.lotexpo_company_ref !== c.lotexpo_company_ref) data.lotexpo_company_ref = f.lotexpo_company_ref;
    if (Object.keys(data).length > 0) await enqueue(me, cache.exhibitorId, 'contact', c.id, data);
    setOpen(false);
    toast({ description: 'Fiche mise à jour' });
  };

  const input = (k: Field, placeholder: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input
      placeholder={placeholder}
      className="h-12 text-base"
      value={f[k]}
      onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))}
      {...extra}
    />
  );

  return (
    <section className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Personne rencontrée</h3>
        {canEdit && (
          <Button size="sm" variant="outline" className="min-h-[40px]" onClick={startEdit}>
            Modifier
          </Button>
        )}
      </div>
      <Row label="Prénom et nom" value={[c.first_name, c.last_name].filter(Boolean).join(' ')} />
      <Row
        label="Entreprise"
        value={
          c.company_name && (
            <span className="inline-flex items-center gap-2">
              {logo && <img onError={(e) => { e.currentTarget.style.display = 'none'; }} src={logo} alt="" className="h-6 w-6 rounded border border-border bg-background object-contain" />}
              {c.company_name}
            </span>
          )
        }
      />
      <Row label="Poste" value={c.job_title} />
      <Row label="Email" value={c.email} />
      <Row label="Téléphone" value={c.phone} />
      <Row label="LinkedIn" value={c.linkedin_url} />
      {!canEdit && <p className="mt-2 text-xs text-muted-foreground">Seul l'auteur de la fiche ou un manager peut la modifier.</p>}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier la fiche</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 pb-[env(safe-area-inset-bottom)]">
            {input('first_name', 'Prénom')}
            {input('last_name', 'Nom')}
            <div className="space-y-2">
              <Input
                placeholder="Entreprise"
                className="h-12 text-base"
                value={f.company_name}
                autoComplete="off"
                onChange={(e) => {
                  setF((p) => ({ ...p, company_name: e.target.value, company_domain: null, lotexpo_company_ref: null }));
                  setCompanyQuery(e.target.value);
                }}
              />
              {companies.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {companies.map((co) => (
                    <li key={co.public_identity_id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted"
                        onClick={() => {
                          setF((p) => ({ ...p, company_name: co.name, company_domain: co.domain, lotexpo_company_ref: co.public_identity_id }));
                          setCompanies([]);
                          setCompanyQuery('');
                        }}
                      >
                        {co.logo_url ? (
                          <img onError={(e) => { e.currentTarget.style.display = 'none'; }} src={co.logo_url} alt="" className="h-8 w-8 rounded border border-border bg-background object-contain" />
                        ) : (
                          <Building2 className="h-8 w-8 p-1 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{co.name}</span>
                          {co.domain && <span className="block truncate text-xs text-muted-foreground">{co.domain}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {input('job_title', 'Poste')}
            {input('email', 'Email', { type: 'email', inputMode: 'email' })}
            {input('phone', 'Téléphone', { type: 'tel', inputMode: 'tel' })}
            {input('linkedin_url', 'LinkedIn', { inputMode: 'url' })}
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button className="min-h-[48px] w-full" onClick={() => void save()}>
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
