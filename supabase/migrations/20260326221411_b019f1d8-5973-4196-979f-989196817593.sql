
-- Fix in-cosmetics-global: remove fake pricing, replace with factual statement
UPDATE events SET description_enrichie = regexp_replace(
  description_enrichie,
  E'L''entrée reste gratuite pour les inscriptions réalisées avant le 30 mars 2026, puis facturée 70 euros\\.',
  E'L''accès est gratuit pour les professionnels du secteur.'
)
WHERE slug = 'in-cosmetics-global';

-- Fix carrefour-international-du-bois: remove "organisé en cycle biennal"
UPDATE events SET description_enrichie = replace(
  description_enrichie,
  ', organisé en cycle biennal pour réunir',
  ' qui réunit'
)
WHERE slug = 'carrefour-international-du-bois';

-- Fix fip-solution-plastique: fix anglicism + forbidden word
UPDATE events SET description_enrichie = replace(
  replace(
    description_enrichie,
    'composites and caoutchouc',
    'composites et caoutchoucs'
  ),
  'carrefour incontournable',
  'rendez-vous professionnel'
)
WHERE slug = 'fip-solution-plastique';

-- Set all 6 pilot events to statut valide
UPDATE events SET enrichissement_statut = 'valide'
WHERE slug IN (
  'food-hotel-tech',
  'in-cosmetics-global',
  'carrefour-international-du-bois',
  'fip-solution-plastique',
  'medfel',
  'sepem-industries-brest'
);
