/**
 * radar-crm-email-dispatcher/email-render.ts
 *
 * Rendu des deux emails Radar CRM (digest avec accès, teaser sans accès) sur la DA Lotexpo.
 * Toute la coquille (en-tête navy + logo, pied navy, couleurs, typographies) vient de
 * _shared/email-template.ts : aucune couleur n'est définie ici en dur.
 *
 * Contrat inchangé par rapport aux anciennes fonctions de index.ts :
 *   renderEmail(p, unsubscribeUrl, appBaseUrl)       -> { html, text }
 *   renderTeaserEmail(p, unsubscribeUrl, appBaseUrl) -> { html, text }
 * Les versions texte sont reprises à l'identique.
 */
import {
  renderEmailShell, heading, paragraph, EMAIL_COLORS, EMAIL_FONTS,
} from '../_shared/email-template.ts';

const C = EMAIL_COLORS;
const F = EMAIL_FONTS;

// Types minimaux : seuls les champs lus par le rendu (compatibles avec PreviewBuild de index.ts).
type RenderGroup = { eventId: string; event: any; companies: any[] };
type RenderBuild = {
  subject: string;
  companiesCount: number;
  eventsCount: number;
  starredCount: number;
  groups: RenderGroup[];
};

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}

function faviconUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const d = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!d) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`;
}

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]!.toUpperCase()).join('');
}

function safeHttpUrl(v: unknown): string | null {
  try {
    const u = new URL(String(v ?? '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch { return null; }
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

// ---------------------------------------------------------------------------
// Blocs communs
// ---------------------------------------------------------------------------

function eyebrow(text: string): string {
  return `<p style="margin:0 0 8px 0;font-family:${F.body};font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.violet};">${esc(text)}</p>`;
}

function summaryBox(p: RenderBuild, closing: string): string {
  const nC = p.companiesCount;
  const nE = p.eventsCount;
  const starred = p.starredCount > 0
    ? `<br><span style="color:${C.violet};font-weight:700;">&#9733; ${p.starredCount} ${plural(p.starredCount, 'prioritaire', 'prioritaires')} dans votre veille</span>`
    : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px 0;">
    <tr><td style="background:${C.sky};border-radius:8px;padding:16px 20px;font-family:${F.body};font-size:15px;line-height:22px;color:${C.navy};">
      <strong style="font-size:20px;">${nC}</strong> ${plural(nC, 'entreprise', 'entreprises')} de votre CRM &middot; <strong style="font-size:20px;">${nE}</strong> ${plural(nE, 'salon', 'salons')}${starred}
      <br><span style="color:${C.textSecondary};font-size:14px;">${closing}</span>
    </td></tr>
  </table>`;
}

function eventImage(g: RenderGroup): string {
  const img = safeHttpUrl(g.event?.url_image);
  if (!img) return '';
  return `<tr><td align="center" style="padding:18px 18px 0 18px;"><img src="${esc(img)}" width="180" alt="${esc(g.event?.nom_event ?? 'Salon')}" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>`;
}

function eventHeader(g: RenderGroup, label: string): string {
  const name = esc(String(g.event?.nom_event ?? '—'));
  const meta = [
    formatDateFr(g.event?.date_debut ?? null),
    g.event?.ville ? String(g.event.ville) : '',
    g.event?.nom_lieu ? String(g.event.nom_lieu) : '',
  ].filter(Boolean).map(esc).join(' &middot; ');
  return `
    <p style="margin:0 0 6px 0;font-family:${F.body};font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.violet};">${esc(label)}</p>
    <h2 style="margin:0 0 4px 0;font-family:${F.heading};font-size:21px;line-height:27px;font-weight:700;color:${C.navy};word-break:break-word;">${name}</h2>
    <p style="margin:0 0 14px 0;font-family:${F.body};font-size:13px;line-height:20px;color:${C.textSecondary};word-break:break-word;">${meta}</p>`;
}

function smallButton(href: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0 0;">
      <tr><td align="center" bgcolor="${C.violet}" style="border-radius:8px;mso-padding-alt:12px 16px;">
        <a href="${esc(href)}" style="display:block;padding:12px 16px;font-family:${F.body};font-size:15px;line-height:20px;font-weight:600;color:${C.white};text-decoration:none;text-align:center;border-radius:8px;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

function card(inner: string, image: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;border:1px solid ${C.grey};border-left:4px solid ${C.violet};border-radius:8px;table-layout:fixed;">
    ${image}
    <tr><td style="padding:18px 18px 20px 18px;word-wrap:break-word;">${inner}</td></tr>
  </table>`;
}

function footerNote(unsubscribeUrl: string): string {
  return `Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.<br><a href="${esc(unsubscribeUrl)}" style="color:${C.footerLink};text-decoration:underline;">Se désabonner des emails Radar CRM</a>`;
}

const sourceNote = `<p style="margin:18px 0 8px 0;font-family:${F.body};font-size:13px;line-height:20px;color:${C.textSecondary};text-align:center;">Ces informations sont basées sur les données de participation disponibles sur Lotexpo à la date d’envoi.</p>`;

// ---------------------------------------------------------------------------
// Digest (accès actif)
// ---------------------------------------------------------------------------

function companyRow(co: any): string {
  const primary = String(co.exhibitorName ?? co.companyName ?? '—');
  const name = esc(primary);
  const isStarred = co.isStarred === true;
  const crmName = co.exhibitorName && co.companyName && co.companyName !== co.exhibitorName
    ? esc(String(co.companyName)) : '';
  const fav = faviconUrl(co.normalizedDomain);
  const sub = [
    crmName ? `CRM : ${crmName}` : '',
    co.normalizedDomain ? esc(String(co.normalizedDomain)) : '',
    co.stand ? `Stand ${esc(String(co.stand))}` : '',
  ].filter(Boolean).join(' &middot; ');
  const logo = fav
    ? `<img src="${esc(fav)}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:6px;border:1px solid ${C.grey};background:${C.white};">`
    : `<div style="width:32px;height:32px;border-radius:6px;background:${C.navy};color:${C.white};font-family:${F.body};font-weight:700;font-size:13px;line-height:32px;text-align:center;">${esc(companyInitials(primary))}</div>`;
  const starBadge = isStarred
    ? `<span style="display:inline-block;margin:0 0 0 6px;padding:3px 8px;background:${C.violet};color:${C.white};border-radius:999px;font-family:${F.body};font-size:11px;line-height:14px;font-weight:700;">&#9733; Prioritaire</span>`
    : '';
  return `
      <tr><td style="padding:5px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${isStarred ? '#f3f0ff' : C.white};border:1px solid ${isStarred ? C.violet : C.grey};border-radius:8px;">
          <tr>
            <td width="44" valign="top" style="width:44px;padding:10px 0 10px 12px;vertical-align:top;">${logo}</td>
            <td valign="top" style="padding:10px 12px;vertical-align:top;font-family:${F.body};">
              <div style="font-size:15px;line-height:20px;font-weight:700;color:${C.navy};word-break:break-word;">${name}</div>
              ${sub ? `<div style="margin-top:2px;font-size:12px;line-height:18px;color:${C.textSecondary};word-break:break-word;">${sub}</div>` : ''}
              <div style="margin-top:6px;"><span style="display:inline-block;padding:3px 8px;background:${C.sky};color:${C.navy};border-radius:999px;font-size:11px;line-height:14px;font-weight:600;">Présent dans votre CRM</span>${starBadge}</div>
            </td>
          </tr>
        </table>
      </td></tr>`;
}

export function renderEmail(p: RenderBuild, unsubscribeUrl: string, appBaseUrl: string) {
  const totalCompanies = p.companiesCount;
  const totalEvents = p.eventsCount;

  const cards = p.groups.map((g) => {
    const eventLink = `${appBaseUrl}/radar-crm/results?eventId=${g.eventId}`;
    const title = g.companies.length > 1 ? 'Entreprises détectées dans votre CRM' : 'Entreprise détectée dans votre CRM';
    const inner = `
      ${eventHeader(g, 'Opportunité Radar CRM')}
      <p style="margin:0 0 4px 0;font-family:${F.body};font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${C.navy};">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${g.companies.map(companyRow).join('')}</table>
      ${smallButton(eventLink, 'Voir cette opportunité')}`;
    return card(inner, eventImage(g));
  }).join('');

  const html = renderEmailShell({
    title: p.subject,
    preheader: `${totalCompanies} ${plural(totalCompanies, 'entreprise', 'entreprises')} de votre CRM exposent sur ${totalEvents} ${plural(totalEvents, 'salon', 'salons')}. Préparez vos rendez-vous.`,
    bodyBlocks: [
      eyebrow('Radar CRM'),
      heading('De nouvelles opportunités salon détectées'),
      paragraph('Radar CRM a détecté que des entreprises présentes dans votre fichier CRM exposent prochainement sur des salons référencés par Lotexpo.'),
      summaryBox(p, 'Préparez vos rendez-vous avant l’événement.'),
      cards,
      sourceNote,
    ],
    cta: { label: 'Voir toutes mes opportunités Radar CRM', href: `${appBaseUrl}/radar-crm` },
    footer: { extraHtml: footerNote(unsubscribeUrl) },
  });

  const textLines = [
    'Lotexpo · Radar CRM',
    'De nouvelles opportunités salon détectées',
    '',
    `${totalCompanies} entreprise${totalCompanies > 1 ? 's' : ''} de votre CRM · ${totalEvents} salon${totalEvents > 1 ? 's' : ''}`,
    'Préparez vos rendez-vous avant l’événement.',
    '',
    "Radar CRM a détecté que des entreprises présentes dans votre fichier CRM exposent prochainement sur des salons référencés par Lotexpo.",
    '',
  ];
  for (const g of p.groups) {
    textLines.push(`▶ ${g.event.nom_event ?? '—'}`);
    textLines.push(`  ${formatDateFr(g.event.date_debut)} · ${g.event.ville ?? '—'}${g.event.nom_lieu ? ` · ${g.event.nom_lieu}` : ''}`);
    const label = g.companies.length > 1 ? 'Entreprises détectées dans votre CRM' : 'Entreprise détectée dans votre CRM';
    textLines.push(`  ${label} :`);
    for (const co of g.companies as any[]) {
      const primary = String(co.exhibitorName ?? co.companyName ?? '—');
      const parts = [primary];
      if (co.exhibitorName && co.companyName && co.companyName !== co.exhibitorName) {
        parts.push(`CRM : ${co.companyName}`);
      }
      if (co.stand) parts.push(`stand ${co.stand}`);
      if (co.normalizedDomain) parts.push(co.normalizedDomain);
      textLines.push(`    • ${parts.join(' · ')}`);
    }
    textLines.push(`  Voir cette opportunité : ${appBaseUrl}/radar-crm/results?eventId=${g.eventId}`);
    textLines.push('');
  }
  textLines.push(`Voir toutes mes opportunités Radar CRM : ${appBaseUrl}/radar-crm`);
  textLines.push('');
  textLines.push("Ces informations sont basées sur les données de participation disponibles sur Lotexpo à la date d'envoi.");
  textLines.push('Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.');
  textLines.push(`Se désabonner : ${unsubscribeUrl}`);

  return { html, text: textLines.join('\n') };
}

// ---------------------------------------------------------------------------
// Teaser (accès inactif : les entreprises restent masquées)
// ---------------------------------------------------------------------------

export function renderTeaserEmail(p: RenderBuild, unsubscribeUrl: string, appBaseUrl: string) {
  const totalCompanies = p.companiesCount;
  const totalEvents = p.eventsCount;
  const reactivateUrl = `${appBaseUrl}/radar-crm`;

  const cards = p.groups.map((g) => {
    const inner = `
      ${eventHeader(g, 'Opportunité Radar CRM')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="border:1px dashed ${C.violet};background:#f3f0ff;border-radius:8px;padding:16px;font-family:${F.body};">
          <div style="font-size:22px;line-height:26px;">&#128274;</div>
          <div style="margin-top:4px;font-size:15px;line-height:20px;font-weight:700;color:${C.navy};">Des entreprises de votre CRM exposent ici</div>
          <div style="margin-top:4px;font-size:13px;line-height:19px;color:${C.textSecondary};">Réactivez Radar CRM pour voir lesquelles.</div>
        </td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:${F.body};font-size:14px;line-height:20px;"><a href="${esc(reactivateUrl)}" style="color:${C.violet};font-weight:700;text-decoration:none;">Réactiver pour voir &rarr;</a></p>`;
    return card(inner, eventImage(g));
  }).join('');

  const html = renderEmailShell({
    title: p.subject,
    preheader: `${totalCompanies} ${plural(totalCompanies, 'entreprise', 'entreprises')} de votre CRM exposent sur ${totalEvents} ${plural(totalEvents, 'salon', 'salons')}. Réactivez Radar CRM pour voir lesquelles.`,
    bodyBlocks: [
      eyebrow('Radar CRM'),
      heading('De nouvelles opportunités salon détectées'),
      paragraph('Des entreprises présentes dans votre fichier CRM exposent prochainement sur des salons référencés par Lotexpo. Votre accès Radar CRM est actuellement inactif : réactivez-le pour découvrir lesquelles.'),
      summaryBox(p, 'Réactivez pour préparer vos rendez-vous.'),
      cards,
      sourceNote,
    ],
    cta: { label: 'Réactiver Radar CRM', href: reactivateUrl },
    footer: { extraHtml: footerNote(unsubscribeUrl) },
  });

  const textLines = [
    'Lotexpo · Radar CRM',
    'De nouvelles opportunités salon détectées',
    '',
    `${totalCompanies} entreprise${totalCompanies > 1 ? 's' : ''} de votre CRM · ${totalEvents} salon${totalEvents > 1 ? 's' : ''}`,
    'Votre accès Radar CRM est actuellement inactif. Réactivez-le pour voir quelles entreprises exposent.',
    '',
  ];
  for (const g of p.groups) {
    textLines.push(`▶ ${g.event.nom_event ?? '—'}`);
    textLines.push(`  ${formatDateFr(g.event.date_debut)} · ${g.event.ville ?? '—'}${g.event.nom_lieu ? ` · ${g.event.nom_lieu}` : ''}`);
    textLines.push('  🔒 Des entreprises de votre CRM exposent ici — réactivez pour voir lesquelles.');
    textLines.push('');
  }
  textLines.push(`Réactiver Radar CRM : ${appBaseUrl}/radar-crm`);
  textLines.push('');
  textLines.push("Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.");
  textLines.push(`Se désabonner : ${unsubscribeUrl}`);

  return { html, text: textLines.join('\n') };
}

