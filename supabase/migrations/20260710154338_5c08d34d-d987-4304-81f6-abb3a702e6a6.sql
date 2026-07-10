-- =====================================================================
-- Seed des sous-secteurs (taxonomie validée) — idempotent (ON CONFLICT DO NOTHING)
-- Rattache chaque sous-secteur à sa macro via jointure sur sectors.name
-- (pas d'UUID en dur). Ré-exécutable sans erreur.
-- =====================================================================
INSERT INTO public.sub_sectors (name, sector_id)
SELECT v.name, s.id
FROM (VALUES
  -- 1. Agroalimentaire & Boissons
  ('Agroalimentaire & transformation alimentaire','Agroalimentaire & Boissons'),
  ('Boissons, vins & spiritueux','Agroalimentaire & Boissons'),
  ('Restauration & services alimentaires','Agroalimentaire & Boissons'),
  ('Agriculture & élevage','Agroalimentaire & Boissons'),
  ('Nutrition & alimentation animale','Agroalimentaire & Boissons'),
  ('Machines & équipements agricoles','Agroalimentaire & Boissons'),
  ('Horticulture & production végétale','Agroalimentaire & Boissons'),
  -- 2. Automobile & Mobilité
  ('Automobile & motos','Automobile & Mobilité'),
  ('Aéronautique & aérospatial','Automobile & Mobilité'),
  ('Ferroviaire','Automobile & Mobilité'),
  ('Cycle & micromobilité','Automobile & Mobilité'),
  ('Maritime & naval','Automobile & Mobilité'),
  ('Équipementiers & pièces','Automobile & Mobilité'),
  ('Mobilité & services de transport','Automobile & Mobilité'),
  -- 3. BTP & Construction
  ('Construction, bâtiment & gros œuvre','BTP & Construction'),
  ('Matériaux de construction & revêtements','BTP & Construction'),
  ('Menuiserie, fermetures & aménagement','BTP & Construction'),
  ('Travaux publics & aménagement extérieur','BTP & Construction'),
  ('Rénovation & second œuvre','BTP & Construction'),
  -- 4. Cosmétique & Bien-être
  ('Cosmétiques & produits de beauté','Cosmétique & Bien-être'),
  ('Parfumerie','Cosmétique & Bien-être'),
  ('Bien-être & soins','Cosmétique & Bien-être'),
  -- 5. Énergie & Environnement
  ('Énergies renouvelables & transition énergétique','Énergie & Environnement'),
  ('Eau, assainissement & traitement','Énergie & Environnement'),
  ('Gestion des déchets & recyclage','Énergie & Environnement'),
  ('Environnement & développement durable','Énergie & Environnement'),
  -- 6. Industrie & Production
  ('Machines-outils & équipements industriels','Industrie & Production'),
  ('Métallurgie & travail des métaux','Industrie & Production'),
  ('Plasturgie & transformation des plastiques','Industrie & Production'),
  ('Mécanique de précision & usinage','Industrie & Production'),
  ('Automatisation & robotique industrielle','Industrie & Production'),
  ('Sous-traitance industrielle','Industrie & Production'),
  ('Emballage & conditionnement','Industrie & Production'),
  ('Bois & transformation du bois','Industrie & Production'),
  ('Chimie, matériaux & composites','Industrie & Production'),
  ('Électronique & composants','Industrie & Production'),
  -- 7. Santé & Médical
  ('Dispositifs & équipements médicaux','Santé & Médical'),
  ('Pharmacie & biotechnologies','Santé & Médical'),
  ('Santé & prévention','Santé & Médical'),
  -- 8. Technologie & Innovation
  ('Logiciels & SaaS','Technologie & Innovation'),
  ('Cybersécurité & protection des données','Technologie & Innovation'),
  ('Services numériques & transformation digitale','Technologie & Innovation'),
  ('Informatique & télécommunications','Technologie & Innovation'),
  ('IA, data & innovation','Technologie & Innovation'),
  -- 9. Mode & Textile
  ('Mode & habillement','Mode & Textile'),
  ('Textile & confection','Mode & Textile'),
  ('Accessoires & maroquinerie','Mode & Textile'),
  ('Bijouterie, joaillerie & luxe','Mode & Textile'),
  ('Chaussure','Mode & Textile'),
  -- 10. Commerce & Distribution
  ('Distribution & commerce de gros','Commerce & Distribution'),
  ('Commerce de détail & retail','Commerce & Distribution'),
  ('Logistique, transport & supply chain','Commerce & Distribution'),
  ('Import / export','Commerce & Distribution'),
  -- 11. Éducation & Formation
  ('Formation professionnelle','Éducation & Formation'),
  ('Enseignement & éducation','Éducation & Formation'),
  ('Médias & édition spécialisée','Éducation & Formation'),
  -- 12. Tourisme & Événementiel
  ('Tourisme & voyages','Tourisme & Événementiel'),
  ('Hôtellerie','Tourisme & Événementiel'),
  ('Loisirs & divertissement','Tourisme & Événementiel'),
  ('Sports & plein air','Tourisme & Événementiel'),
  ('Événementiel','Tourisme & Événementiel'),
  -- 13. Finance, Assurance & Immobilier
  ('Services financiers & investissement','Finance, Assurance & Immobilier'),
  ('Assurance','Finance, Assurance & Immobilier'),
  ('Gestion de patrimoine & d''actifs','Finance, Assurance & Immobilier'),
  ('Immobilier','Finance, Assurance & Immobilier'),
  ('Capital-investissement','Finance, Assurance & Immobilier'),
  -- 14. Services aux Entreprises & RH
  ('Conseil & services professionnels','Services aux Entreprises & RH'),
  ('Ressources humaines & recrutement','Services aux Entreprises & RH'),
  ('Marketing & communication','Services aux Entreprises & RH'),
  ('Services aux entreprises (généraux)','Services aux Entreprises & RH'),
  -- 15. Secteur Public & Collectivités
  ('Administration & collectivités territoriales','Secteur Public & Collectivités'),
  ('Services publics','Secteur Public & Collectivités'),
  ('Sécurité & défense','Secteur Public & Collectivités')
) AS v(name, macro)
JOIN public.sectors s ON s.name = v.macro
ON CONFLICT (name) DO NOTHING;