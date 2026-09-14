// organizer-import-parse
// Lot 2 — Import des listes exposants organisateur.
//
// Role : recevoir les lignes brutes d'un classeur deja lu cote client, les NETTOYER
// cote serveur, puis deleguer l'ingestion a la RPC organizer_stage_lines().
//
// Repartition volontaire :
//   - le client ne fait que transformer un .xlsx en tableau de chaines (SheetJS).
//     Il n'a AUCUNE autorite sur les donnees.
//   - cette fonction nettoie le texte et les URL, et produit domain_full.
//   - la RPC calcule domain_registrable via registrable_domain(), valide
//     l'id_exposant et detecte les doublons. registrable_domain n'est JAMAIS
//     reimplemente ici : une seule source de verite.
//
// Fonction distincte de organizer-exhibitor-import, qui garde ses actions upload
// et signed_url intactes. Ne pas fusionner : la redeployer imposerait de renvoyer
// ses dependances partagees (dont email-template.ts, 11 Ko) et approcherait la
// limite de troncature silencieuse au deploiement.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://lotexpo.fr',
  'https://lotexpo.com',
  'https://www.lotexpo.com',
  'https://lotexpo.lovable.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

function matchOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app')) return origin;
  return null;
}

function corsFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': matchOrigin(origin) ?? 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const EMPTY_TOKENS = new Set(['', '-', '--', 'n/a', 'na', 'nc', 'aucun', 'aucune', 'null', 'none', '.']);

/** Nettoyage generique d'une cellule : espaces, caracteres invisibles, jetons vides. */
function cleanCell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v)
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (EMPTY_TOKENS.has(s.toLowerCase())) return null;
  return s;
}

const LEGAL_FORMS = [
  'sas', 'sasu', 'sarl', 'eurl', 'sa', 'sci', 'snc', 'scop', 'sca', 'selarl',
  'gmbh', 'ag', 'ltd', 'limited', 'llc', 'inc', 'corp', 'bv', 'nv', 'srl', 'spa', 'plc', 'oy', 'ab', 'as',
];

/** Nom normalise : minuscules, sans accents, sans ponctuation, sans forme juridique finale. */
function normalizeName(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of LEGAL_FORMS) {
      if (s.endsWith(' ' + f)) {
        s = s.slice(0, -(f.length + 1)).trim();
        changed = true;
      }
    }
  }
  return s || null;
}

// Domaines de plateformes : jamais retenus comme site d'une entreprise,
// sauf si la plateforme est elle-meme l'exposant (voir brandMatches).
const PLATFORM_DOMAINS = new Set([
  'linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'threads.net',
  'google.com', 'sites.google.com', 'business.site', 'blogspot.com',
  'wixsite.com', 'wix.com', 'wordpress.com', 'weebly.com', 'squarespace.com',
  'pagesjaunes.fr', 'societe.com', 'verif.com', 'infogreffe.fr',
  'europages.fr', 'kompass.com', 'bing.com', 'yelp.com',
]);

/**
 * La plateforme est-elle l'exposant lui-meme ?
 * Regle deterministe : le nom normalise vaut la marque, ou commence par elle.
 * "linkedin france" + linkedin.com => vrai. "acme solutions" + linkedin.com => faux.
 */
function brandMatches(nomNormalized: string | null, registrable: string): boolean {
  if (!nomNormalized) return false;
  const brand = registrable.split('.')[0].replace(/[^a-z0-9]/g, '');
  if (!brand) return false;
  return nomNormalized === brand || nomNormalized.startsWith(brand + ' ');
}

/** Repli local de reduction au domaine enregistrable, UNIQUEMENT pour le test de plateforme. */
const TWO_LEVEL = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.br', 'com.au', 'net.au', 'org.au',
  'co.jp', 'co.nz', 'co.za', 'com.mx', 'com.tr', 'com.cn', 'com.es', 'asso.fr', 'tm.fr',
  'nom.fr', 'prd.fr', 'com.fr', 'gouv.fr', 'co.it', 'com.pl', 'com.pt', 'com.ua',
  'com.ar', 'com.sg', 'com.hk', 'co.kr', 'co.in', 'com.my',
]);

function registrableOf(host: string): string | null {
  if (/^[0-9]+(\.[0-9]+){3}$/.test(host)) return null;
  const p = host.split('.');
  if (p.length < 2) return null;
  if (p.length >= 3 && TWO_LEVEL.has(p[p.length - 2] + '.' + p[p.length - 1])) {
    return p.slice(-3).join('.');
  }
  return p.slice(-2).join('.');
}

type UrlResult = { domain_full: string | null; flag: string };

/** Sequence de nettoyage d'URL. Voir section 4.1 de la procedure. */
function cleanUrl(raw: string | null, nomNormalized: string | null): UrlResult {
  if (!raw) return { domain_full: null, flag: 'missing_website' };

  let s = raw.toLowerCase().replace(/\s+/g, '');

  if (s.startsWith('mailto:') || s.startsWith('tel:')) {
    return { domain_full: null, flag: 'invalid_url' };
  }
  // Une adresse email n'est pas une URL
  if (s.includes('@') && !/^https?:\/\//.test(s)) {
    return { domain_full: null, flag: 'invalid_url' };
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) {
    s = 'https://' + s;
  }

  let host: string;
  try {
    host = new URL(s).hostname;
  } catch {
    return { domain_full: null, flag: 'invalid_url' };
  }

  host = host.replace(/^www[0-9]?\./, '').replace(/\.$/, '');

  if (!host.includes('.') || host === 'localhost' || /^[0-9]+(\.[0-9]+){3}$/.test(host)) {
    return { domain_full: null, flag: 'invalid_url' };
  }

  const reg = registrableOf(host);
  if (reg && PLATFORM_DOMAINS.has(reg) && !brandMatches(nomNormalized, reg)) {
    // Le lien est ecarte. Il n'est jamais ecrit dans exposants ni participation.
    return { domain_full: null, flag: 'platform_url' };
  }

  return { domain_full: host, flag: 'ok' };
}

// ---------------------------------------------------------------------------
// Point d'entree
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const headers = { ...corsFor(origin), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(origin) });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST requis' }), { status: 405, headers });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Configuration serveur incomplete' }), { status: 500, headers });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Authentification invalide' }), { status: 401, headers });
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Admin uniquement, meme source de verite que is_admin()
  const { data: isAdmin, error: roleErr } = await service.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  });
  if (roleErr) {
    return new Response(JSON.stringify({ error: 'Verification du role impossible' }), { status: 500, headers });
  }
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Acces refuse' }), { status: 403, headers });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), { status: 400, headers });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: 'rows doit etre un tableau non vide' }), { status: 400, headers });
  }
  if (rows.length > 5000) {
    return new Response(JSON.stringify({ error: 'Fichier trop volumineux (5000 lignes maximum)' }), { status: 400, headers });
  }

  // ---- Resolution de l'import cible -------------------------------------
  let importId = typeof body.import_id === 'string' ? body.import_id : null;

  if (importId) {
    const { data: imp, error: impErr } = await service
      .from('organizer_exhibitor_imports')
      .select('id, status')
      .eq('id', importId)
      .maybeSingle();
    if (impErr || !imp) {
      return new Response(JSON.stringify({ error: 'Import introuvable' }), { status: 404, headers });
    }
    if (imp.status === 'applied') {
      return new Response(
        JSON.stringify({ error: 'Import deja applique, il ne peut plus etre re-parse', code: 'ALREADY_APPLIED' }),
        { status: 409, headers },
      );
    }
  } else {
    // Depot direct par l'administrateur, sans passage par l'espace organisateur
    const eventId = typeof body.event_id === 'string' ? body.event_id : null;
    if (!eventId) {
      return new Response(JSON.stringify({ error: 'import_id ou event_id requis' }), { status: 400, headers });
    }
    const { data: ev } = await service.from('events').select('id').eq('id', eventId).maybeSingle();
    if (!ev) {
      return new Response(JSON.stringify({ error: 'Salon introuvable' }), { status: 404, headers });
    }
    const fileName = typeof body.file_name === 'string' ? body.file_name : 'saisie-admin.xlsx';
    const { data: created, error: createErr } = await service
      .from('organizer_exhibitor_imports')
      .insert({
        event_id: eventId,
        uploaded_by: user.id,
        file_path: `admin-inline/${Date.now()}_${fileName.replace(/[^\w.\-]+/g, '_').slice(0, 120)}`,
        original_name: fileName,
      })
      .select('id')
      .single();
    if (createErr || !created) {
      return new Response(
        JSON.stringify({ error: 'Creation de l import impossible', details: createErr?.message }),
        { status: 500, headers },
      );
    }
    importId = created.id;
  }

  // ---- Nettoyage ligne par ligne ----------------------------------------
  const cleaned = rows.map((r: Record<string, unknown>, i: number) => {
    const rawNom = cleanCell(r.nom ?? r.raw_nom);
    const rawStand = cleanCell(r.stand ?? r.raw_stand);
    const rawWebsite = cleanCell(r.website ?? r.raw_website);
    const rawDescription = cleanCell(r.description ?? r.raw_description);
    const rawId = cleanCell(r.id_exposant ?? r.raw_id_exposant);
    const nomNormalized = normalizeName(rawNom);

    let flag = 'ok';
    let domainFull: string | null = null;

    if (!rawNom) {
      flag = 'missing_name';
    } else {
      const u = cleanUrl(rawWebsite, nomNormalized);
      domainFull = u.domain_full;
      if (u.flag !== 'ok') flag = u.flag;
    }

    return {
      line_no: typeof r.line_no === 'number' ? r.line_no : i + 1,
      raw_id_exposant: rawId,
      raw_nom: rawNom,
      raw_stand: rawStand,
      raw_website: rawWebsite,
      raw_description: rawDescription,
      nom_normalized: nomNormalized,
      domain_full: domainFull,
      parse_flag: flag,
    };
  });

  // ---- Ingestion : la RPC calcule domain_registrable et valide les ids ---
  const { data: stats, error: rpcErr } = await service.rpc('organizer_stage_lines', {
    p_import_id: importId,
    p_rows: cleaned,
  });

  if (rpcErr) {
    console.error('[organizer-import-parse] organizer_stage_lines a echoue', rpcErr.message);
    return new Response(
      JSON.stringify({ error: 'Ingestion impossible', details: rpcErr.message }),
      { status: 500, headers },
    );
  }

  return new Response(
    JSON.stringify({ success: true, import_id: importId, stats }),
    { status: 200, headers },
  );
});
