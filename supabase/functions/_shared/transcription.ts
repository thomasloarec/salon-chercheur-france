// Interface fournisseur-agnostique. Aujourd'hui : OpenAI direct.
// Point de bascule UNIQUE pour un futur endpoint EU (résidence des données)
// ou un autre prestataire, sans toucher aux Edge Functions appelantes.

import { openaiTranscribe } from './openai.ts';

export interface TranscribeInput {
  audio: Blob;
  filename: string;
  language?: string;
  prompt?: string;
}

export interface TranscribeResult {
  text: string;
  provider: string;
  model: string;
}

export class TranscriptionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
  }
}

export async function transcribe(input: TranscribeInput): Promise<TranscribeResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new TranscriptionError('missing_api_key', 'OPENAI_API_KEY absent des secrets Supabase.');
  }
  const model = Deno.env.get('RADAR_VOICE_TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe';
  try {
    const text = await openaiTranscribe({
      audio: input.audio,
      filename: input.filename,
      model,
      language: input.language,
      prompt: input.prompt,
      apiKey,
    });
    return { text, provider: 'openai', model };
  } catch (e) {
    const code = (e && typeof e === 'object' && 'code' in e) ? String((e as { code: string }).code) : 'transcription_failed';
    throw new TranscriptionError(code, e instanceof Error ? e.message : String(e));
  }
}