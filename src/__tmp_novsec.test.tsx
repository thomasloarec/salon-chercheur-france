import { test, expect, mock } from 'bun:test';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

let NOVELTIES: any[] = [];
mock.module('@/hooks/useMyNovelties', () => ({ useMyNovelties: () => ({ data: NOVELTIES, isLoading: false }) }));
mock.module('@/hooks/usePremiumEntitlement', () => ({ usePremiumEntitlement: () => ({ data: { isPremium: false } }) }));
mock.module('@/components/novelty/NoveltyLeadsDisplay', () => ({ default: () => React.createElement('div', null, 'leads') }));
mock.module('@/components/novelty/LeadCaptureCard', () => ({ default: () => React.createElement('div', null, 'capture') }));
mock.module('@/components/agenda/EventPremiumStatus', () => ({ EventPremiumStatus: () => null }));
mock.module('@/components/agenda/ExhibitorMeetingRequests', () => ({ ExhibitorMeetingRequests: () => React.createElement('div', null, 'rdv') }));
mock.module('@/components/novelty/EditNoveltyDialog', () => ({ EditNoveltyDialog: ({ novelty }: any) => React.createElement('div', null, novelty.title) }));

const Section = (await import('@/components/exhibitor/manage/ExhibitorNoveltiesSection')).default;

const render = () => renderToString(
  React.createElement(MemoryRouter, null,
    React.createElement(Section, {
      exhibitorId: 'ex1', exhibitorName: 'Acme', exhibitorLogoUrl: null,
      exhibitorPublicSlug: 'acme', hasUpcomingParticipation: true, onGoToSalons: () => {},
    })));

const base = (over: any) => ({
  id: 'n1', title: 'Ma nouveauté', type: 'Launch', status: 'published', created_at: '2026-01-01',
  media_urls: [], slug: 'ma-nouveaute', stats: { likes: 1, brochure_leads: 0, meeting_leads: 0, total_leads: 1 },
  exhibitors: { id: 'ex1', name: 'Acme', slug: 'acme' },
  events: { id: 'e1', nom_event: 'Salon X', slug: 'salon-x', ville: 'Paris', date_debut: '2026-10-01', date_fin: '2026-10-03' },
  ...over,
});

test('aucune nouveauté', () => { NOVELTIES = []; expect(render()).toContain('Publier une Nouveauté'); });
test('publiée', () => { NOVELTIES = [base({})]; const h = render(); expect(h).toContain('Publiée'); expect(h).toContain('Ma nouveauté'); });
test('en attente', () => { NOVELTIES = [base({ status: 'draft' })]; expect(render()).toContain('En attente de validation'); });
test('événement sans slug ignoré proprement', () => {
  NOVELTIES = [base({ events: { id: 'e1', nom_event: 'Salon X', slug: null, ville: null, date_debut: null, date_fin: null } })];
  expect(render()).toContain('Salon X');
});
