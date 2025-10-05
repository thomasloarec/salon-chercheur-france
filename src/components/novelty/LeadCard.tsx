import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Mail, Phone, Building2, Briefcase, FileText } from 'lucide-react';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  notes?: string;
  lead_type: 'resource_download' | 'meeting_request';
  created_at: string;
}

interface LeadCardProps {
  lead: Lead;
  isPremium: boolean;
}

export default function LeadCard({ lead, isPremium }: LeadCardProps) {
  const maskData = (text: string | undefined) => {
    if (!text) return '';
    if (isPremium) return text;
    // Flouter : montrer 2 premiers caractères + ***
    return text.slice(0, 2) + '***';
  };

  return (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium">
              {lead.first_name} {isPremium ? lead.last_name : '***'}
            </p>
            <Badge variant="outline" className="text-xs">
              {lead.lead_type === 'resource_download' ? '📄 Brochure' : '🤝 RDV'}
            </Badge>
          </div>
          
          {/* Contact Info */}
          <div className="space-y-1">
            <div className={`flex items-center gap-2 text-sm ${!isPremium ? 'blur-[3px] select-none' : ''}`}>
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{maskData(lead.email)}</span>
            </div>
            
            {lead.phone && (
              <div className={`flex items-center gap-2 text-sm ${!isPremium ? 'blur-[3px] select-none' : ''}`}>
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span>{maskData(lead.phone)}</span>
              </div>
            )}
            
            {lead.company && (
              <div className={`flex items-center gap-2 text-sm ${!isPremium ? 'blur-[3px] select-none' : ''}`}>
                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{maskData(lead.company)}</span>
              </div>
            )}
            
            {lead.role && (
              <div className={`flex items-center gap-2 text-sm ${!isPremium ? 'blur-[3px] select-none' : ''}`}>
                <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{maskData(lead.role)}</span>
              </div>
            )}
            
            {lead.notes && isPremium && (
              <div className="flex items-start gap-2 text-sm mt-2 pt-2 border-t">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-muted-foreground text-xs">{lead.notes}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Date */}
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
          {format(new Date(lead.created_at), 'dd/MM/yy', { locale: fr })}
        </span>
      </div>
    </Card>
  );
}
