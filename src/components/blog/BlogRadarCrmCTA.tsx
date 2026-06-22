import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Radar, ArrowRight } from 'lucide-react';

/**
 * Discrete CTA toward Radar CRM, shown at the bottom of GENERIC editorial articles only.
 * Intentionally lighter than the newsletter CTA so it stays non-intrusive.
 */
const BlogRadarCrmCTA = () => (
  <section className="mx-auto px-4 max-w-[720px] mb-14">
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-5 sm:p-6">
      <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
        <Radar className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-[15px] font-semibold text-foreground leading-snug">
          Vous voulez savoir où vos clients et prospects exposent ?
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Testez Radar CRM sur Lotexpo.
        </p>
      </div>
      <Link to="/radar-crm" className="shrink-0">
        <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg">
          Découvrir Radar CRM <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </Link>
    </div>
  </section>
);

export default BlogRadarCrmCTA;
