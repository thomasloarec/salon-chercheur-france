import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, MapPin, CalendarDays, Sparkles } from 'lucide-react';
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

type Bubble =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; result?: LeadMagnetResult; error?: string };

const EXAMPLES = ['Un gros client', 'Un concurrent', 'Adoria'];

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
        Nous n'avons pas trouvé cette entreprise dans notre index. Essayez une autre orthographe,
        son site web, ou une autre entreprise.
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

interface Props {
  onSearched?: (query: string) => void;
}

const LeadMagnetChat = ({ onSearched }: Props) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const counter = useRef(0);

  const run = async (raw: string) => {
    const query = raw.trim();
    if (!query || loading) return;
    counter.current += 1;
    const uid = `u-${counter.current}`;
    setBubbles((prev) => [...prev, { id: uid, role: 'user', text: query }]);
    setInput('');
    setLoading(true);
    onSearched?.(query);

    let result: LeadMagnetResult | undefined;
    let errorMsg: string | undefined;

    try {
      const { data, error } = await supabase.functions.invoke('leadmagnet-search', {
        body: { query, similar_limit: 6 },
      });
      if (error) {
        let code = '';
        try {
          const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
          const body = ctx?.text ? await ctx.text() : '';
          code = body;
        } catch {
          /* ignore */
        }
        if (code.includes('rate_limited')) {
          errorMsg = "Trop de recherches d'affilée, réessayez dans un instant.";
        } else if (code.includes('query_trop_courte')) {
          errorMsg = 'Le nom saisi est trop court, essayez un nom plus complet.';
        } else {
          errorMsg = 'La recherche est momentanément indisponible. Réessayez dans un instant.';
        }
      } else {
        result = data as LeadMagnetResult;
      }
    } catch {
      errorMsg = 'La recherche est momentanément indisponible. Réessayez dans un instant.';
    }

    counter.current += 1;
    setBubbles((prev) => [
      ...prev,
      { id: `a-${counter.current}`, role: 'assistant', result, error: errorMsg },
    ]);
    setLoading(false);
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
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
        <Button type="submit" disabled={loading || !input.trim()} className="h-12 rounded-full px-6">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Rechercher
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => run(ex)}
            disabled={loading}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {(bubbles.length > 0 || loading) && (
        <div className="mt-6 space-y-4">
          {bubbles.map((b) =>
            b.role === 'user' ? (
              <div key={b.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {b.text}
                </div>
              </div>
            ) : (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <AssistantBubble result={b.result} error={b.error} />
              </div>
            ),
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Recherche en cours…
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadMagnetChat;