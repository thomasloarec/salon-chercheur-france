/**
 * Centralized Anthropic / Claude configuration.
 *
 * Why a shared module:
 * - Single source of truth for the Claude model used across edge functions.
 * - Migration cost = update one constant when Anthropic releases a new Sonnet.
 * - Forbids forgotten beta headers (e.g. removed `context-1m-2025-08-07`).
 *
 * Override per-environment via the `ANTHROPIC_MODEL_FAST` secret if needed.
 */

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Default fast Sonnet model. `claude-sonnet-4-6` is the official Anthropic
 * alias that always points to the latest stable Sonnet 4.6 snapshot.
 * (Replaces the now-deprecated `claude-sonnet-4-20250514` and the removed
 * `context-1m-2025-08-07` 1M-context beta on Sonnet 4 / 4.5.)
 */
export const DEFAULT_ANTHROPIC_MODEL_FAST = 'claude-sonnet-4-6';

export function getAnthropicModelFast(): string {
  return Deno.env.get('ANTHROPIC_MODEL_FAST') || DEFAULT_ANTHROPIC_MODEL_FAST;
}

export function buildAnthropicHeaders(apiKey: string): HeadersInit {
  // NOTE: do NOT add `anthropic-beta: context-1m-2025-08-07` — that beta
  // was retired by Anthropic. Requests including it on Sonnet 4 / 4.5 fail
  // for prompts > 200K tokens. Keep this header set minimal.
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'Content-Type': 'application/json',
  };
}

export interface AnthropicCallOptions {
  apiKey: string;
  model?: string;
  system?: string;
  userMessage: string;
  maxTokens: number;
  /** Abort signal (e.g. for timeouts). */
  signal?: AbortSignal;
  /** Logical caller name, surfaced in logs only. */
  caller?: string;
}

export interface AnthropicCallResult {
  ok: boolean;
  text: string | null;
  /** HTTP status from Anthropic, or 0 on network/timeout errors. */
  status: number;
  /** Stable error category for client mapping. */
  errorCode?:
    | 'context_too_long'
    | 'rate_limited'
    | 'timeout'
    | 'server_error'
    | 'auth_error'
    | 'bad_request'
    | 'network_error'
    | 'empty_response';
  /** Human-readable error (truncated, no API key). */
  error?: string;
  model: string;
}

/**
 * Single point of entry for Claude calls. Handles:
 * - Header hygiene (no forbidden beta).
 * - Structured error categorization (context too long, 429, 5xx, timeout…).
 * - Logging the model used + error type, never the API key.
 */
export async function callAnthropic(opts: AnthropicCallOptions): Promise<AnthropicCallResult> {
  const model = opts.model || getAnthropicModelFast();
  const tag = opts.caller ? `[anthropic:${opts.caller}]` : '[anthropic]';

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: buildAnthropicHeaders(opts.apiKey),
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens,
        messages: [{ role: 'user', content: opts.userMessage }],
        ...(opts.system ? { system: opts.system } : {}),
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 500);
      let errorCode: AnthropicCallResult['errorCode'] = 'server_error';
      if (response.status === 400 && /context|token|too\s*long/i.test(errorText)) {
        errorCode = 'context_too_long';
      } else if (response.status === 400) {
        errorCode = 'bad_request';
      } else if (response.status === 401 || response.status === 403) {
        errorCode = 'auth_error';
      } else if (response.status === 429) {
        errorCode = 'rate_limited';
      } else if (response.status >= 500) {
        errorCode = 'server_error';
      }
      console.error(`${tag} ${response.status} ${errorCode} model=${model} body=${errorText}`);
      return {
        ok: false,
        text: null,
        status: response.status,
        errorCode,
        error: `Claude API ${response.status}: ${errorText.slice(0, 200)}`,
        model,
      };
    }

    const result = await response.json();
    const text = result?.content?.[0]?.text?.trim() ?? null;
    if (!text) {
      console.error(`${tag} empty_response model=${model}`);
      return { ok: false, text: null, status: 200, errorCode: 'empty_response', error: 'Empty Claude response', model };
    }
    return { ok: true, text, status: 200, model };
  } catch (err) {
    const isAbort = (err as Error)?.name === 'AbortError';
    const errorCode: AnthropicCallResult['errorCode'] = isAbort ? 'timeout' : 'network_error';
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ${errorCode} model=${model} message=${message}`);
    return { ok: false, text: null, status: 0, errorCode, error: message, model };
  }
}