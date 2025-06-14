
import { supabase } from '@/integrations/supabase/client';

interface Exhibitor {
  name: string;
  stand?: string;
  website?: string;
}

interface MatchResult {
  exhibitors: Exhibitor[];
  crmTargets: Exhibitor[];
}

export const matchExhibitorsWithCRM = async (exhibitors: Exhibitor[]): Promise<MatchResult> => {
  try {
    // Fetch companies from CRM (companies table)
    const { data: companies, error } = await supabase
      .from('companies')
      .select('name, website');

    if (error) {
      console.error('Error fetching companies:', error);
      return { exhibitors, crmTargets: [] };
    }

    if (!companies) {
      return { exhibitors, crmTargets: [] };
    }

    const crmTargets: Exhibitor[] = [];

    // Match exhibitors with CRM companies
    exhibitors.forEach(exhibitor => {
      const isMatch = companies.some(company => {
        // Match by name (case insensitive, partial match)
        const nameMatch = company.name.toLowerCase().includes(exhibitor.name.toLowerCase()) ||
                         exhibitor.name.toLowerCase().includes(company.name.toLowerCase());
        
        // Match by website domain if both have websites
        let websiteMatch = false;
        if (exhibitor.website && company.website) {
          const exhibitorDomain = exhibitor.website.replace(/^https?:\/\//, '').replace(/^www\./, '');
          const companyDomain = company.website.replace(/^https?:\/\//, '').replace(/^www\./, '');
          websiteMatch = exhibitorDomain.includes(companyDomain) || companyDomain.includes(exhibitorDomain);
        }

        return nameMatch || websiteMatch;
      });

      if (isMatch) {
        crmTargets.push(exhibitor);
      }
    });

    return {
      exhibitors,
      crmTargets
    };
  } catch (error) {
    console.error('Error in CRM matching:', error);
    return { exhibitors, crmTargets: [] };
  }
};
