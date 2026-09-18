/**
 * Réponses types du support Lotexpo.
 * Modifiez librement les libellés et les textes.
 */
export interface CannedReply {
  label: string;
  body: string;
}

export const CANNED_REPLIES: CannedReply[] = [
  {
    label: 'Prise en charge',
    body: "Bonjour, merci pour votre message. Nous prenons votre demande en charge et revenons vers vous très vite.",
  },
  {
    label: 'Demande de précisions',
    body: "Bonjour, pour traiter votre demande au plus juste, pouvez-vous nous préciser la page concernée et ce que vous attendez comme correction ?",
  },
  {
    label: 'Correction effectuée',
    body: "Bonjour, la correction est en ligne. N'hésitez pas à rafraîchir la page pour la voir. Dites-nous si quelque chose ne va pas.",
  },
  {
    label: 'Clôture',
    body: "Bonjour, nous considérons votre demande comme traitée. Vous pouvez nous réécrire ici à tout moment si besoin.",
  },
];
