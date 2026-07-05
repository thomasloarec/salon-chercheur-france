import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Radar CRM — indicateur d'auteur discret pour une note / tâche PERSISTÉE.
 *
 * Affichage seul (aucune collaboration : pas d'attribution, mentions, ni filtre).
 * Rendu UNIQUEMENT quand le compte a plus d'un membre actif (activeMemberCount > 1) ;
 * en compte solo, ne rend rien (comportement historique).
 *
 * Style discret aligné sur la palette de marque via tokens sémantiques :
 *  - pastille : fond peach (bg-secondary) + initiales navy (text-primary), bordure border,
 *  - nom : petit texte atténué (text-muted-foreground),
 * pour ne jamais concurrencer le corps de la note. Compact, wrap propre sur mobile.
 */

/**
 * Initiales dérivées de author_name :
 *  - 2 premiers mots → 1re lettre de chacun,
 *  - un seul mot → 2 premières lettres,
 * en majuscules. Retombe sur '?' si rien d'exploitable.
 */
const initialsFrom = (name: string): string => {
  const words = name.split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * Nom d'affichage propre avec fallbacks :
 *  - author_name résolu → tel quel,
 *  - sinon local-part d'un email si author_name en est un,
 *  - sinon 'Membre'.
 */
const resolveName = (authorName: string | null | undefined): string => {
  const raw = (authorName ?? '').trim();
  if (!raw) return 'Membre';
  // Email non résolu côté serveur : n'afficher que la partie locale.
  if (raw.includes('@') && !raw.includes(' ')) {
    const local = raw.split('@')[0]?.trim();
    return local && local.length > 0 ? local : 'Membre';
  }
  return raw;
};

interface RadarAuthorBadgeProps {
  authorName: string | null | undefined;
  activeMemberCount: number | null | undefined;
  className?: string;
}

const RadarAuthorBadge: React.FC<RadarAuthorBadgeProps> = ({
  authorName,
  activeMemberCount,
  className,
}) => {
  // Compte solo (ou inconnu) : aucun indicateur d'auteur.
  if (!activeMemberCount || activeMemberCount <= 1) return null;

  const name = resolveName(authorName);
  const initials = initialsFrom(name);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 min-w-0 max-w-full',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[9px] font-semibold leading-none text-primary"
      >
        {initials}
      </span>
      <span className="truncate text-[11px] text-muted-foreground">{name}</span>
    </span>
  );
};

export default RadarAuthorBadge;
