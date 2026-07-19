/**
 * _shared/email-template.ts
 *
 * Gabarit email unique Lotexpo. Toute la structure HTML et toute la couleur vivent ici.
 * Les fonctions email ne produisent que leur CONTENU (bodyBlocks) et le passent a renderEmailShell.
 * Changer une couleur ici change tous les emails d'un coup.
 *
 * Contraintes email respectees :
 *  - tables role="presentation" (pas de flex/grid/position)
 *  - styles 100% inline, aucune classe pour la couleur
 *  - largeur fixe 600px, centree
 *  - bouton bulletproof (VML conditionnel pour Outlook)
 *  - images avec alt + dimensions explicites ; aucune information enfermee dans une image
 *  - preheader (texte d'apercu)
 *  - hint light-only pour limiter l'inversion en mode sombre
 *  - en-tete et pied navy : robustes au mode sombre (deja sombres, pas d'inversion cassante)
 *  - lisible et actionnable images bloquees (le bouton est un fond CSS, pas une image)
 *
 * Module sans dependance : utilisable tel quel par Deno (edge functions) ET executable par Node.
 */

export const EMAIL_COLORS = {
  navy: '#0b132b',
  violet: '#6b51ff',
  blue: '#2563ff',
  sky: '#b6e3ff',
  grey: '#e6e8ec',
  white: '#ffffff',
  amber: '#d97706',
  red: '#de213a',
  textSecondary: '#5c6684',
  // Teintes claires reservees au pied navy (contraste sur fond sombre).
  // Sur surface sombre, le lien n'est PAS violet (contraste insuffisant) mais bleu ciel.
  footerText: '#c9d2ec',
  footerLink: '#b6e3ff',
} as const;

export const EMAIL_FONTS = {
  heading: "'Playfair Display', Georgia, 'Times New Roman', serif",
  body: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

/**
 * Logo hebergé en HTTPS. Les clients email ne rendent PAS le SVG : il faut un PNG.
 * A REMPLACER par l'URL publique reelle une fois les 2 PNG heberges
 * (Supabase Storage bucket public, ou public/ du site sur lotexpo.com).
 *  - WHITE : lettres blanches + accent violet, pour en-tete/pied navy (defaut).
 *  - NAVY  : lettres navy + accent violet, pour un eventuel en-tete clair.
 */
export const EMAIL_LOGO_URL_WHITE = 'https://vxivdvzzhebobveedxbj.supabase.co/storage/v1/object/public/email-assets/lotexpo-email-white.png';
export const EMAIL_LOGO_URL_NAVY = 'https://vxivdvzzhebobveedxbj.supabase.co/storage/v1/object/public/email-assets/lotexpo-email-navy.png';

const C = EMAIL_COLORS;
const F = EMAIL_FONTS;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --------------------------------------------------------------------------
// Helpers de blocs (chaque fonction renvoie une chaine HTML prete a empiler)
// --------------------------------------------------------------------------

export function heading(text: string): string {
  return `<h1 style="margin:0 0 14px 0;font-family:${F.heading};font-size:26px;line-height:32px;font-weight:700;color:${C.navy};">${text}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${F.body};font-size:16px;line-height:24px;color:${C.navy};">${html}</p>`;
}

/** Lien inline (violet sur surface claire). */
export function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${C.violet};text-decoration:underline;">${label}</a>`;
}

export interface EmailButton {
  label: string;
  href: string;
}

/** Bouton d'action bulletproof (VML pour Outlook, ancre stylee ailleurs). */
export function button(btn: EmailButton): string {
  const href = escapeHtml(btn.href);
  const label = escapeHtml(btn.label);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:10px auto 6px auto;">
    <tr><td align="center" bgcolor="${C.violet}" style="border-radius:8px;" class="btn">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="16%" fillcolor="${C.violet}" stroke="f"><w:anchorlock/><center style="color:${C.white};font-family:${F.body};font-size:16px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" style="display:inline-block;padding:14px 34px;font-family:${F.body};font-size:16px;font-weight:600;line-height:20px;color:${C.white};text-decoration:none;border-radius:8px;background:${C.violet};">${label}</a>
      <!--<![endif]-->
    </td></tr>
  </table>`;
}

/** Encart d'information : surface bleu ciel, texte navy. */
export function infoBox(html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr><td style="background:${C.sky};border-radius:8px;padding:16px 20px;font-family:${F.body};font-size:15px;line-height:22px;color:${C.navy};">${html}</td></tr>
  </table>`;
}

/** Encart d'avertissement : bordure et icone ambre, texte navy (jamais d'ambre sur du texte). */
export function warningBox(html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr><td style="background:${C.white};border:1px solid ${C.grey};border-left:4px solid ${C.amber};border-radius:8px;padding:16px 20px;font-family:${F.body};font-size:15px;line-height:22px;color:${C.navy};">
      <span style="color:${C.amber};font-size:17px;font-weight:bold;">&#9888;</span>&#160;&#160;${html}
    </td></tr>
  </table>`;
}

/** Encart critique : bordure rouge ; le rouge peut porter du texte (titre). */
export function criticalBox(title: string, html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr><td style="background:${C.white};border:1px solid ${C.grey};border-left:4px solid ${C.red};border-radius:8px;padding:16px 20px;font-family:${F.body};font-size:15px;line-height:22px;color:${C.navy};">
      <strong style="color:${C.red};">${escapeHtml(title)}</strong><br>${html}
    </td></tr>
  </table>`;
}

/** Separateur : filet gris clair. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:10px 0;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.grey};">&#160;</div></td></tr></table>`;
}

/**
 * Tableau cle / valeur (notifications, recapitulatifs). Les valeurs sont echappees
 * en interne : passer des valeurs brutes (donnees utilisateur), pas du HTML.
 */
export function dataTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(([label, value], i) => {
      const top = i === 0 ? '' : `border-top:1px solid ${C.grey};`;
      return `
        <tr>
          <td style="${top}padding:9px 14px;font-family:${F.body};font-size:13px;line-height:18px;color:${C.textSecondary};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="${top}padding:9px 14px;font-family:${F.body};font-size:14px;line-height:20px;color:${C.navy};font-weight:600;word-break:break-word;">${escapeHtml(value)}</td>
        </tr>`;
    })
    .join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;border:1px solid ${C.grey};border-radius:8px;">${body}
  </table>`;
}

// --------------------------------------------------------------------------
// Pied de page (bande navy)
// --------------------------------------------------------------------------

export interface FooterOptions {
  tagline?: string;
  unsubscribeUrl?: string;
  extraHtml?: string;
}

export function renderFooter(opts: FooterOptions = {}): string {
  const tagline = opts.tagline ?? "L'intelligence des salons professionnels.";
  const unsub = opts.unsubscribeUrl
    ? `<p style="margin:14px 0 0 0;font-family:${F.body};font-size:12px;line-height:18px;color:${C.footerText};"><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${C.footerLink};text-decoration:underline;">Se desinscrire</a></p>`
    : '';
  const extra = opts.extraHtml
    ? `<p style="margin:14px 0 0 0;font-family:${F.body};font-size:12px;line-height:18px;color:${C.footerText};">${opts.extraHtml}</p>`
    : '';
  return `
      <tr><td style="background:${C.navy};padding:28px 32px;" class="px">
        <p style="margin:0;font-family:${F.heading};font-size:18px;line-height:22px;font-weight:700;color:${C.white};">Lotexpo</p>
        <p style="margin:6px 0 0 0;font-family:${F.body};font-size:13px;line-height:20px;color:${C.footerText};">${escapeHtml(tagline)}</p>
        ${unsub}
        ${extra}
      </td></tr>`;
}

// --------------------------------------------------------------------------
// Coquille complete
// --------------------------------------------------------------------------

export interface EmailShellOptions {
  title: string;
  preheader: string;
  bodyBlocks: string[];
  cta?: EmailButton;
  /** URL HTTPS du logo. Defaut : variante blanche (en-tete navy). */
  logoUrl?: string;
  footer?: FooterOptions;
}

export function renderEmailShell(opts: EmailShellOptions): string {
  const logo = opts.logoUrl ?? EMAIL_LOGO_URL_WHITE;
  const title = escapeHtml(opts.title);
  const preheader = escapeHtml(opts.preheader);
  const blocks = opts.bodyBlocks.join('\n        ');
  const ctaHtml = opts.cta ? button(opts.cta) : '';
  const footerHtml = renderFooter(opts.footer ?? {});
  // Spacer invisible : empeche la boite de reception d'afficher le debut du corps apres l'objet.
  const spacer = '&#847;&zwnj;&#160;'.repeat(30);

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${title}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
  body{margin:0;padding:0;width:100%!important;height:100%!important;background:${C.grey};}
  a{color:${C.violet};}
  @media only screen and (max-width:600px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:22px!important;padding-right:22px!important;}
    .btn a{display:block!important;text-align:center!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.grey};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.grey};opacity:0;">${preheader}${spacer}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.grey};">
  <tr><td align="center" style="padding:24px 12px;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.white};border-radius:12px;overflow:hidden;">
      <tr><td align="center" style="background:${C.navy};padding:22px 32px;">
        <img src="${escapeHtml(logo)}" width="150" height="39" alt="Lotexpo" style="display:block;width:150px;height:39px;color:${C.white};font-family:${F.heading};font-size:20px;">
      </td></tr>
      <tr><td class="px" style="padding:28px 32px 8px 32px;">
        ${blocks}
        ${ctaHtml}
      </td></tr>
      ${footerHtml}
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>`;
}
