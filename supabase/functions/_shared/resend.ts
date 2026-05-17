// Shared Resend helper for Lotexpo edge functions.
//
// IMPORTANT — this helper is currently used ONLY by previewing/scaffolding
// code paths (e.g. radar-crm-email-dispatcher dry-run). Real sends remain
// gated by feature flags in each caller. This file does not send anything
// by itself.

export interface SendResendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
  from?: string;
  replyTo?: string;
}

export interface SendResendEmailResult {
  id: string;
}

function defaultFrom(): string {
  return Deno.env.get('RESEND_FROM_EMAIL') ?? 'Lotexpo <admin@lotexpo.com>';
}

/**
 * Send an email through the Resend API.
 *
 * Throws if RESEND_API_KEY is missing. Never logs the API key. Returns the
 * Resend message id on success.
 */
export async function sendResendEmail(
  options: SendResendEmailOptions,
): Promise<SendResendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const to = Array.isArray(options.to) ? options.to : [options.to];
  const body: Record<string, unknown> = {
    from: options.from ?? defaultFrom(),
    to,
    subject: options.subject,
  };
  if (options.html) body.html = options.html;
  if (options.text) body.text = options.text;
  if (options.tags && options.tags.length > 0) body.tags = options.tags;
  if (options.replyTo) body.reply_to = options.replyTo;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Resend API error ${resp.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await resp.json().catch(() => ({}))) as { id?: string };
  if (!data.id) {
    throw new Error('Resend API did not return a message id');
  }
  return { id: data.id };
}