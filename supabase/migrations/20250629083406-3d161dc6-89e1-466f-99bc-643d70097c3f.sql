
-- Insertion des 3 nouveaux secteurs manquants dans la table sectors
INSERT INTO sectors (id, name, description, keywords) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440013',
  'Finance, Assurance & Immobilier',
  'Services financiers, assurance et marché immobilier',
  ARRAY['finance', 'banque', 'assurance', 'immobilier', 'crédit', 'investissement', 'patrimoine']
),
(
  '550e8400-e29b-41d4-a716-446655440014', 
  'Services aux Entreprises & RH',
  'Conseil, ressources humaines et services aux entreprises',
  ARRAY['conseil', 'consulting', 'rh', 'ressources humaines', 'formation', 'recrutement', 'audit', 'expertise comptable']
),
(
  '550e8400-e29b-41d4-a716-446655440015',
  'Secteur Public & Collectivités', 
  'Administration publique, collectivités territoriales et services publics',
  ARRAY['public', 'collectivité', 'mairie', 'conseil régional', 'administration', 'service public', 'gouvernement']
);
