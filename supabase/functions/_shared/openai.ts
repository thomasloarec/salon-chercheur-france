// Appel de transcription OpenAI (implémentation concrète, isolée derrière transcription.ts).
// Ne jamais logger la clé.

export interface OpenAITranscribeParams {
  audio: Blob;
  filename: string;   // DOIT porter la bonne extension (.webm/.m4a/.mp3/.wav)
  model: string;      // gpt-4o-mini-transcribe | gpt-4o-transcribe
  language?: string;  // 'fr'
  prompt?: string;    // amorçage noms propres / vocabulaire métier
  apiKey: string;
}

export class OpenAITranscriptionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OpenAITranscriptionError';
    this.code = code;
  }
}

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';

export async function openaiTranscribe(p: OpenAITranscribeParams): Promise<string> {
  const form = new FormData();
  form.append('file', p.audio, p.filename);
  form.append('model', p.model);
  form.append('response_format', 'json');
  if (p.language) form.append('language', p.language);
  if (p.prompt) form.append('prompt', p.prompt);

  let res: Response;
  try {
    res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.apiKey}` },
      body: form,
    });
  } catch (e) {
    throw new OpenAITranscriptionError('network', `OpenAI injoignable: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const code = res.status === 429 ? 'rate_limited'
      : res.status === 413 ? 'file_too_large'
      : res.status >= 500 ? 'provider_error'
      : 'bad_request';
    throw new OpenAITranscriptionError(code, `OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = await res.json().catch(() => ({}));
  return (json.text ?? '').toString();
}