import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, MapPin, CalendarDays, Sparkles, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

export interface LeadMagnetSalon {
  event_id?: string;
  nom_event?: string;
  ville?: string;
  date_debut?: string;
  date_fin?: string;
  slug?: string;
  stand?: string;
}

export interface LeadMagnetProspect {
  exhibitor_id?: string;
  nom_exposant?: string;
  secteur_principal?: string;
  sous_secteurs?: string[];
  produits_services?: string[];
  mots_cles_metier?: string[];
  resume_court?: string;
  website?: string;
  public_slug?: string;
  similarity?: number;
  salons?: LeadMagnetSalon[];
}

export interface LeadMagnetResult {
  query?: string;
  resolved?: { id_exposant?: string; nom?: string; website?: string } | null;
  mode: 'found' | 'prospects' | 'not_found' | 'empty';
  own_participations?: LeadMagnetSalon[];
  similar_prospects?: LeadMagnetProspect[];
}

interface Candidate {
  id_exposant: string;
  nom?: string;
  domaine?: string;
  description?: string;
  similarity?: number;
  has_upcoming?: boolean;
}

interface ResolveResponse {
  query?: string;
  match_type?: string;
  count?: number;
  candidates?: Candidate[];
}

type ExampleRow = { nom: string; secteur: string; nb_upcoming: number };

type Step = 'input' | 'confirm' | 'choose' | 'result' | 'error' | 'not_found';

function formatDateRangeFr(start?: string, end?: string) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const dayMonth = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const full = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!e || start === end) return full(s);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()} au ${full(e)}`;
  }
  if (s.getFullYear() === e.getFullYear()) return `${dayMonth(s)} au ${full(e)}`;
  return `${full(s)} au ${full(e)}`;
}

const SalonLine = ({ salon }: { salon: LeadMagnetSalon }) => {
  const title = salon.nom_event ?? 'Salon';
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="text-sm font-semibold text-foreground">
        {salon.slug ? (
          <Link to={`/events/${salon.slug}`} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {salon.ville && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {salon.ville}
          </span>
        )}
        {salon.date_debut && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateRangeFr(salon.date_debut, salon.date_fin)}
          </span>
        )}
        {salon.stand && <span>Stand {salon.stand}</span>}
      </div>
    </div>
  );
};

const ProspectCard = ({ prospect }: { prospect: LeadMagnetProspect }) => {
  const name = prospect.nom_exposant ?? 'Entreprise';
  const why = [
    prospect.secteur_principal,
    ...(prospect.produits_services ?? []).slice(0, 2),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-base font-semibold text-foreground">
          {prospect.public_slug ? (
            <Link to={`/exposants/${prospect.public_slug}`} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </div>
        {prospect.secteur_principal && (
          <Badge variant="secondary" className="text-[11px]">
            {prospect.secteur_principal}
          </Badge>
        )}
      </div>
      {why && <p className="mt-1 text-xs text-muted-foreground">Pourquoi : {why}</p>}
      {(prospect.salons ?? []).length > 0 && (
        <div className="mt-3 space-y-2">
          {(prospect.salons ?? []).map((s, i) => (
            <SalonLine key={`${s.event_id ?? s.slug ?? i}`} salon={s} />
          ))}
        </div>
      )}
    </div>
  );
};

const AssistantBubble = ({ result, error }: { result?: LeadMagnetResult; error?: string }) => {
  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }
  if (!result) return null;

  const prospects = result.similar_prospects ?? [];
  const own = result.own_participations ?? [];
  const nom = result.resolved?.nom ?? result.query;

  if (result.mode === 'not_found') {
    return (
      <p className="text-sm text-foreground">
        Nous n'avons pas cette entreprise dans notre index. Essayez une autre orthographe, ou son
        site web.
      </p>
    );
  }

  if (result.mode === 'empty') {
    return (
      <p className="text-sm text-foreground">
        Saisissez le nom d'une entreprise de votre portefeuille pour commencer.
      </p>
    );
  }

  if (result.mode === 'found') {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-foreground">
          {nom} sera présent sur {own.length} salon{own.length > 1 ? 's' : ''} à venir :
        </p>
        <div className="space-y-2">
          {own.map((s, i) => (
            <SalonLine key={`${s.event_id ?? s.slug ?? i}`} salon={s} />
          ))}
        </div>
        {prospects.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              Vous pourriez aussi croiser ces entreprises du même métier :
            </p>
            {prospects.map((p, i) => (
              <ProspectCard key={p.exhibitor_id ?? i} prospect={p} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // mode === 'prospects'
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#0b132b] p-4 text-white">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#b6e3ff]">
          <Sparkles className="h-4 w-4" /> Nouvelles cibles
        </div>
        <p className="mt-2 text-sm">
          Nous n'avons pas trouvé {nom} sur un salon à venir. En revanche, voici {prospects.length}{' '}
          entreprise{prospects.length > 1 ? 's' : ''} du même métier à ajouter à vos cibles :
        </p>
      </div>
      <div className="space-y-3">
        {prospects.map((p, i) => (
          <ProspectCard key={p.exhibitor_id ?? i} prospect={p} />
        ))}
      </div>
    </div>
  );
};

async function mapInvokeError(error: unknown): Promise<string> {
  let body = '';
  try {
    const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
    body = ctx?.text ? await ctx.text() : '';
  } catch {
    /* ignore */
  }
  if (body.includes('rate_limited')) return "Trop de recherches d'affilée, réessayez dans un instant.";
  if (body.includes('query_trop_courte')) return 'Le nom saisi est trop court.';
  return 'La recherche est momentanément indisponible.';
}

interface Props {
  onSearched?: (query: string) => void;
}

const LeadMagnetChat = ({ onSearched }: Props) => {
  const [input, setInput] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [resolving, setResolving] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [result, setResult] = useState<LeadMagnetResult | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [examples, setExamples] = useState<string[]>([]);

  const loadExamples = async () => {
    try {
      const { data } = await supabase.rpc('leadmagnet_example_companies', { p_n: 3 });
      if (data && data.length) {
        setExamples((data as ExampleRow[]).map((d) => d.nom));
      }
    } catch {
      // Silencieux : la rangée de puces disparaît simplement en cas d'erreur.
    }
  };

  useEffect(() => {
    loadExamples();
  }, []);

  const reset = () => {
    setStep('input');
    setCandidates([]);
    setResult(undefined);
    setErrorMsg(undefined);
    setInput('');
  };

  const resolve = async (raw: string) => {
    const query = raw.trim();
    if (!query || resolving) return;
    setResolving(true);
    setErrorMsg(undefined);
    setResult(undefined);
    onSearched?.(query);

    try {
      const { data, error } = await supabase.functions.invoke('leadmagnet-resolve', {
        body: { query },
      });
      if (error) {
        setErrorMsg(await mapInvokeError(error));
        setStep('error');
      } else {
        const res = (data ?? {}) as ResolveResponse;
        const list = res.candidates ?? [];
        if (!res.count || list.length === 0) {
          setStep('not_found');
        } else if (list.length === 1) {
          setCandidates(list);
          setStep('confirm');
        } else {
          setCandidates(list);
          setStep('choose');
        }
      }
    } catch {
      setErrorMsg('La recherche est momentanément indisponible.');
      setStep('error');
    }
    setResolving(false);
  };

  const pick = async (candidate: Candidate) => {
    if (fetchingId) return;
    setFetchingId(candidate.id_exposant);
    setErrorMsg(undefined);
    try {
      const { data, error } = await supabase.functions.invoke('leadmagnet-search-by-id', {
        body: { id_exposant: candidate.id_exposant },
      });
      if (error) {
        setErrorMsg(await mapInvokeError(error));
        setStep('error');
      } else {
        setResult(data as LeadMagnetResult);
        setStep('result');
      }
    } catch {
      setErrorMsg('La recherche est momentanément indisponible.');
      setStep('error');
    }
    setFetchingId(null);
  };

  const upcomingBadge = (c: Candidate) =>
    c.has_upcoming ? (
      <Badge variant="secondary" className="text-[11px]">
        Présent sur des salons à venir
      </Badge>
    ) : null;

  return (
    <div className="w-full">
      {step === 'input' && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolve(input);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nom d'une entreprise cliente ou prospect (ex : Adoria)"
              className="h-12 rounded-full px-5"
              aria-label="Nom d'une entreprise"
            />
            <Button
              type="submit"
              disabled={resolving || !input.trim()}
              className="h-12 rounded-full px-6"
            >
              {resolving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Rechercher
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => resolve(ex)}
                disabled={resolving}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
            {examples.length > 0 && (
              <button
                type="button"
                onClick={loadExamples}
                disabled={resolving}
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                aria-label="Autres exemples"
              >
                <RefreshCcw className="h-3 w-3" /> Autres exemples
              </button>
            )}
          </div>

          {resolving && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Recherche en cours…
            </div>
          )}
        </>
      )}

      {step === 'confirm' && candidates[0] && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-base font-semibold text-foreground">
            S'agit-il bien de {candidates[0].nom}
            {candidates[0].domaine ? ` (${candidates[0].domaine})` : ''} ?
          </p>
          {candidates[0].description && (
            <p className="mt-2 text-sm text-muted-foreground">{candidates[0].description}</p>
          )}
          {candidates[0].has_upcoming && <div className="mt-3">{upcomingBadge(candidates[0])}</div>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => pick(candidates[0])}
              disabled={!!fetchingId}
              className="h-11 rounded-full px-5"
            >
              {fetchingId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Oui, voir ses salons
            </Button>
            <Button
              variant="outline"
              onClick={reset}
              disabled={!!fetchingId}
              className="h-11 rounded-full px-5"
            >
              Non, ce n'est pas ça
            </Button>
          </div>
        </div>
      )}

      {step === 'choose' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Plusieurs entreprises correspondent, laquelle cherchez-vous ?
          </p>
          {candidates.map((c) => (
            <button
              key={c.id_exposant}
              type="button"
              onClick={() => pick(c)}
              disabled={!!fetchingId}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary disabled:opacity-60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold text-foreground">{c.nom}</span>
                {fetchingId === c.id_exposant ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  upcomingBadge(c)
                )}
              </div>
              {c.domaine && <p className="mt-0.5 text-xs text-muted-foreground">{c.domaine}</p>}
              {c.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            disabled={!!fetchingId}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-primary hover:underline disabled:opacity-50"
          >
            Aucune de ces entreprises
          </button>
        </div>
      )}

      {step === 'not_found' && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-foreground">
            Nous n'avons pas cette entreprise dans notre index. Essayez une autre orthographe, ou
            son site web.
          </p>
          <Button variant="outline" onClick={reset} className="mt-4 h-11 rounded-full px-5">
            Nouvelle recherche
          </Button>
        </div>
      )}

      {step === 'error' && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={reset} className="mt-4 h-11 rounded-full px-5">
            Nouvelle recherche
          </Button>
        </div>
      )}

      {step === 'result' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <AssistantBubble result={result} />
          </div>
          <Button variant="outline" onClick={reset} className="h-11 rounded-full px-5">
            <RefreshCcw className="mr-2 h-4 w-4" /> Nouvelle recherche
          </Button>
        </div>
      )}
    </div>
  );
};

export default LeadMagnetChat;
