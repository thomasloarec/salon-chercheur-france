// Petit client Stripe pour les fonctions Lotexpo Leads (sans SDK).
// La clé secrète est lue dans STRIPE_SECRET_KEY et n'est jamais journalisée.

const API = 'https://api.stripe.com/v1';

export function stripeKey(): string {
  const k = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!k) throw new Error('STRIPE_SECRET_KEY manquante');
  return k;
}

/** Mode de la clé : true si clé réelle (sk_live_ ou rk_live_). */
export function keyIsLive(): boolean {
  return /^(sk|rk)_live_/.test(stripeKey());
}

/** Encode un objet imbriqué au format application/x-www-form-urlencoded de Stripe. */
export function formEncode(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === 'object') {
      out.push(...formEncode(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export async function stripeRequest<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${stripeKey()}` };
  let url = `${API}${path}`;
  let body: string | undefined;
  if (params && method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = formEncode(params).join('&');
  } else if (params) {
    url += `?${formEncode(params).join('&')}`;
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(url, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string; code?: string } })?.error;
    throw new Error(`Stripe ${res.status} ${msg?.code ?? ''} ${msg?.message ?? ''}`.trim());
  }
  return data as T;
}

/** Vérifie l'en-tête Stripe-Signature (HMAC SHA-256, tolérance 5 minutes). */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || sigs.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(age) || age > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
