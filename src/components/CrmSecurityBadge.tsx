import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Sceau « CRM sécurisé » — renvoie vers la page /securite-crm.
 * variant="dark" : lisible sur fond navy. variant="light" : fond clair.
 */
const CrmSecurityBadge = ({ variant = 'light', size = 'md', className }: Props) => (
  <Link
    to="/securite-crm"
    className={cn(
      'inline-flex items-center gap-2 rounded-full border font-medium transition-colors',
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
      variant === 'dark'
        ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
        : 'border-primary/25 bg-primary/5 text-primary hover:bg-primary/10',
      className,
    )}
  >
    <ShieldCheck className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden="true" />
    CRM sécurisé
  </Link>
);

export default CrmSecurityBadge;
