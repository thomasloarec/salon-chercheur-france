import { describe, expect, test } from 'bun:test';
import { pickAudioMime, baseMime } from '../mime';
import { applyVoiceFields } from '../applyVoiceFields';
import { emptyDraft } from '../../salon/draft';
import type { BoothVoiceFields } from '@/lib/booth/rpc';

const fields = (p: Partial<BoothVoiceFields>): BoothVoiceFields => ({
  contact: null,
  relationship: null,
  customer_topic: null,
  potential: null,
  project: null,
  next_action: null,
  next_action_due: null,
  note: null,
  ...p,
});

describe('pickAudioMime', () => {
  test('webm opus en priorité', () => {
    expect(pickAudioMime(() => true)).toBe('audio/webm;codecs=opus');
  });
  test('iPhone : audio/mp4', () => {
    expect(pickAudioMime((t) => t === 'audio/mp4')).toBe('audio/mp4');
  });
  test('ogg en dernier recours, aucun sinon', () => {
    expect(pickAudioMime((t) => t === 'audio/ogg;codecs=opus')).toBe('audio/ogg;codecs=opus');
    expect(pickAudioMime(() => false)).toBeNull();
  });
  test('isTypeSupported qui lève une erreur', () => {
    expect(pickAudioMime((t) => { if (t.includes('webm')) throw new Error('x'); return true; })).toBe('audio/mp4');
  });
  test('baseMime retire le codec', () => {
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm');
  });
});

describe('applyVoiceFields', () => {
  test('champs vides ignorés, valeurs saisies conservées', () => {
    const d = { ...emptyDraft(), name: 'Jean Dupont', relationship: 'partner' as const };
    const r = applyVoiceFields(d, fields({ contact: { first_name: 'Paul', last_name: '', company_name: '  ', job_title: null, email: null, phone: null }, relationship: 'customer' }));
    expect(r.name).toBe('Jean Dupont');
    expect(r.company).toBe('');
    expect(r.relationship).toBe('partner');
    expect(r.note).toBe('');
  });
  test('client avec sujet, sans potentiel', () => {
    const r = applyVoiceFields(emptyDraft(), fields({ relationship: 'customer', customer_topic: 'existing_business', potential: 'hot' }));
    expect(r.relationship).toBe('customer');
    expect(r.customer_topic).toBe('existing_business');
    expect(r.potential).toBeNull();
  });
  test('prospect avec potentiel et coordonnée email prioritaire', () => {
    const r = applyVoiceFields(
      emptyDraft(),
      fields({
        contact: { first_name: 'Anne', last_name: 'Martin', company_name: 'Acme', job_title: 'Acheteuse', email: 'a@acme.fr', phone: '0612' },
        relationship: 'new_prospect',
        potential: 'good',
      }),
    );
    expect(r.name).toBe('Anne Martin');
    expect(r.company).toBe('Acme');
    expect(r.coordMode).toBe('email');
    expect(r.coordValue).toBe('a@acme.fr');
    expect(r.phoneExtra).toBe('0612');
    expect(r.potential).toBe('good');
  });
  test('projet sans montant', () => {
    const r = applyVoiceFields(emptyDraft(), fields({ project: { title: 'Ligne', amount: null, value_band: '20_50k', horizon: '3_6m' } }));
    expect(r.concrete).toBe(true);
    expect(r.amount).toBe('');
    expect(r.value_band).toBe('20_50k');
    expect(r.horizon).toBe('3_6m');
  });
  test('échéance absente, note brute si résumé vide', () => {
    const r = applyVoiceFields(emptyDraft(), fields({ next_action: 'call', next_action_due: null }), 'bonjour');
    expect(r.next_action).toBe('call');
    expect(r.due).toBeNull();
    expect(r.note).toBe('Dictée : bonjour');
  });
});
