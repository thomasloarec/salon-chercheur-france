-- Lotexpo Leads, lot P3 : nouveaux prix décidés par Thomas le 10/10/2026.
-- Pass salon 190 € (sous le concurrent le moins cher, Expo Pass ~250 $ par exposant et par salon, et pour toute l'équipe),
-- Annuel 570 € = 3 Pass salon. Prix Stripe de test créés le 10/10 ; les anciens (290 €, 720 €) sont archivés.
UPDATE public.booth_billing_settings
   SET pass_price_id = 'price_1UP51kEbs46kbnkpiae3FaF4',
       pass_amount_cents = 19000,
       annual_price_id = 'price_1UP51nEbs46kbnkpsQ31o2xR',
       annual_amount_cents = 57000,
       updated_at = now()
 WHERE id;
