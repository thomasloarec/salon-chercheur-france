-- 20261001202432_titres_nouveautes_raccourcis.sql (appliquée le 01/10/2026 : 72 titres, statuts et slugs inchangés)
-- Projet « Réduction longueur titre Nouveauté », lot C. Validé par Thomas le 01/10/2026.
-- Raccourcit les 72 titres de plus de 70 caractères des Nouveautés publiées créées par admin@lotexpo.com.
-- Exclus (décision Thomas 01/10/2026) : toute Nouveauté créée par un vrai utilisateur (ici Cloudikids), et les 2 refusées.
-- Garde-fous :
--  * protect_novelty_columns repasse en 'draft' toute nouveauté publiée dont le titre change,
--    sauf service_role : on se place en service_role le temps de la transaction.
--  * le slug est immuable (trigger set_novelty_slug) : aucune URL ne change.
--  * le titre stocké doit être exactement l'ancien (pas d'écrasement d'une modification récente).
--  * contrôle final : aucun statut modifié, aucun titre > 70, nombre de lignes exact.
-- Aval : updated_at change, donc embed_pending_novelties (toutes les 30 min) recalcule les embeddings.
-- La balise <title> prérendue ne change qu'au prochain build Vercel.

BEGIN;
CREATE TEMP TABLE _nouveaux_titres(id uuid PRIMARY KEY, titre text NOT NULL) ON COMMIT DROP;
INSERT INTO _nouveaux_titres(id, titre) VALUES
  ('eb2766a1-b518-4b37-9e11-e83ccc5498dc'::uuid, 'SKIDEAU, skid mobile de filtration et UV pour l''aquaculture'),
  ('63fad191-46f0-482e-9774-dd1b57742230'::uuid, 'Paiement in-car : le cas Volkswagen et une démo'),
  ('75291be8-b8f2-473b-bcfc-3cc0fe5b179f'::uuid, 'Atelier : sortir de SharePoint et de l''écosystème Microsoft'),
  ('37c542f6-de17-45bb-aac4-f7655164b742'::uuid, 'Azimut Grande 44M, nouveau flagship en première mondiale'),
  ('c29b3d62-327f-4d8d-8364-5b1ddab6319a'::uuid, 'TERRA et VEGA, robot et drone de surveillance de sites'),
  ('b561d57e-64b4-4634-891f-ab19a6b7d7ab'::uuid, 'Transmetteur universel SIL 2 avec alarme relais, 17,5 mm'),
  ('acff1f29-462d-440f-9113-c5d0d9c4e44d'::uuid, 'The Fact Check Awards : la vérification des faits en jeu TV'),
  ('00abb6ab-b26e-4106-81fe-5f1496bd5d26'::uuid, 'Drones modulaires, de l''inspection industrielle à la défense'),
  ('4557597d-c3e0-4e98-a708-b1c272064762'::uuid, 'Alimentation et connectivité intégrées au mobilier'),
  ('703cd46c-01c3-4826-b316-a3ceddde03cf'::uuid, 'Chaudières biomasse Windhager de 10 kW à 4 MW'),
  ('726af29a-bb08-4e85-bd74-56e234ea07a8'::uuid, 'Conférence : processus QSE digitalisés chez CPCU (ENGIE)'),
  ('033e9ece-3bf4-4909-b41f-478b74de14b5'::uuid, 'QuickTOCultra : mesure du COT en ligne sur eaux chargées'),
  ('d712a1ab-0ddd-4c10-bd7a-54a6978a9fd7'::uuid, 'Jaco, bras robotisé pour fauteuil roulant électrique'),
  ('7c774029-f564-4100-a4a1-f3700481c234'::uuid, 'Bornes de recharge VE : de la pré-étude à la maintenance'),
  ('823781d1-5c92-43fe-ab9c-c3bd1cefaa09'::uuid, 'Transmission 4G pour la sécurité électronique'),
  ('2a421c53-e55e-4dfa-8eef-0de0f6637737'::uuid, 'KraftWing et KraftWing Light, composites pour drones'),
  ('2e51ba4b-40ab-4e34-8784-dc54e4ee332c'::uuid, 'Formation immersive VR/AR : échanger sur votre projet'),
  ('1c541075-3c07-41fb-9dd0-1d4ed0a5ff04'::uuid, 'Joints d''écluse en polyuréthane pour l''hydroélectrique'),
  ('be7ad4d7-e016-4e8d-b6f8-800640f259b6'::uuid, 'Room Temperature Controller, régulation sans fil'),
  ('74f9c09b-bbb2-4f5b-a352-c7a5ff772361'::uuid, 'Capteurs et gateways LoRaWAN pour le smart building'),
  ('32a7facb-d670-4ab1-8a11-223c44dfba4b'::uuid, 'Kando 85, première coque de la série d''explorer yachts AvA'),
  ('16f012cc-c132-4a83-8af7-5b6aa9ddeafa'::uuid, 'ISA Viper 130 Fast Naan, signé Fulvio De Simoni'),
  ('b51ae145-3af9-4274-b3e9-b703b7cf3314'::uuid, 'Grue LTM 1230-5.1 : test de réduction diesel G&S Diesel'),
  ('e317e108-9cf5-4f8d-9892-eb681f7b8d00'::uuid, 'Systèmes laser de découpe, marquage et gravure'),
  ('da48f1c3-8af6-44c7-af53-8f0b3e076bb6'::uuid, 'Additif graphène drop-in pour la cuisson des composites'),
  ('3c701633-9e0e-4478-bd2c-187c72e77a99'::uuid, 'Seelo EP, SaaS de pilotage des achats d''énergie'),
  ('ccee6543-db12-4ce8-85f2-66d936f5eac1'::uuid, 'Banc de freinage poids lourds CAP9110 au format compact'),
  ('4e73337d-0f96-4154-afbd-ad9ee9875ba6'::uuid, 'Modèles 3D de tissus humains pour tester des actifs'),
  ('b6df793a-3d97-4f22-ae80-d69d4c06d31e'::uuid, 'NEXIV VMF-K, mesure confocale des surfaces transparentes'),
  ('151d3d86-5fe2-4926-873b-6ceef8f3e403'::uuid, 'DAC Mobile, distribution automatisée des concentrés'),
  ('952aa849-706e-4639-a991-fdf9f82aff61'::uuid, 'Conférence : lancer une collection de bijoux avec l''IA'),
  ('8212cb94-e46b-4579-96df-57f4c87dee67'::uuid, 'Ampliroll Marrel AL20 Pro sur Renault Trucks électrique'),
  ('97d34697-345c-4a5c-aad2-92eae89cadd5'::uuid, 'SketchUp et LayOut : 2D, 3D, IA et nuages de points réunis'),
  ('d7c45fbb-eee6-49d6-9a7b-6b9f5f5f6dee'::uuid, 'Sunrise by Wifirst, WiFi managé pour campings et HPA'),
  ('4f2523b2-cc69-43ef-b2fa-c80e1cfdf1f1'::uuid, 'Princess Y80, yacht Y Class de 24 mètres'),
  ('58dd178d-011d-4fb7-8f8e-84e5799884d3'::uuid, 'Publication sur le réemploi du parc HLM, à réserver'),
  ('e9dcfcab-2b77-4984-8991-41bbdab76696'::uuid, 'Anti-drones CUAS pour aéroports, ports et centrales'),
  ('ed59d8b8-c71b-433c-a9d2-2ef602f763f6'::uuid, 'GTB : piloter un parc existant sans tout remplacer'),
  ('f92fc7a4-0696-4b97-9d9d-037c0b1bac55'::uuid, 'Livre blanc sur les freins des femmes micro-entrepreneures'),
  ('c6151289-e665-43d9-afff-f1325d700a85'::uuid, 'Démos de drones à ailes battantes Nimble+ et Nimble Triple'),
  ('7a87d04c-8f41-4360-a7bd-8dfca3abd472'::uuid, 'Synfoplant, plaque réutilisable sans godets plastiques'),
  ('b2293956-c493-46ab-ac39-9ac8ea760ff8'::uuid, 'Pressothérapie PSX Starvac Active Wave à tester sur place'),
  ('4775b45a-0160-4d92-a627-b0a35f860523'::uuid, 'Moteurs, capteurs et solutions thermiques pour drones'),
  ('9cab86b7-69f5-4d64-8f45-69035442d4ba'::uuid, 'Pompe à chaleur Edge AI iGarden en avant-première'),
  ('9686c9ba-1d34-4f72-9b30-97bc93162c89'::uuid, 'D36 Cabin, day boat à cabine fermée en première mondiale'),
  ('a029bf39-92ae-46cb-89d0-9c4911902eb6'::uuid, 'GreenBot, robot distributeur de litière pour logettes'),
  ('39bf671c-30c8-486d-a609-c55dd161ae4d'::uuid, 'PTI Safeguard : localiser un travailleur isolé sans GPS'),
  ('af6ea4f8-dd0f-4af4-9b18-cdc50efc8f12'::uuid, 'Pan-European partnership expanded with Grupa Álava'),
  ('ad28e29c-213f-41fc-908b-2b55b209c4f2'::uuid, 'VYBE 43, power catamaran à finition haut de gamme'),
  ('88438be7-91f5-4f73-b063-b189684fc0c8'::uuid, '3Ready Automotive : vos contenus sur l''écran embarqué'),
  ('5be4d788-97c1-4272-9dc3-0a09774ea6bd'::uuid, 'Série animée jeunesse adaptée de la BD de Kirk Reedstrom'),
  ('0de27e84-3ee6-4589-a332-57c17206d406'::uuid, 'STRADA : modules TIME et Fleet Management'),
  ('ae190c32-e267-4c93-beb0-560bfe0d255a'::uuid, 'BI pour bailleurs sociaux : démo en conditions réelles'),
  ('69134f9b-f4cf-4619-8d08-f40981da0cce'::uuid, 'Trancheuse pâte molle et partisseuse pâte dure pour fromages'),
  ('de1f88b0-cf95-4c7a-8309-39308a2b1352'::uuid, 'Fictions grecques Mega TV disponibles en licence'),
  ('636fa37f-ec2c-456e-b556-61a13e952394'::uuid, 'Magix II, fauteuil électrique 6 roues motrices à essayer'),
  ('17acc08f-ebfd-4515-8cb4-b5d13b6b17c9'::uuid, 'Recyclage composites carbone : DMA et thermographie'),
  ('a5ebcda6-849f-41e8-bdc7-5497e93862e0'::uuid, 'Savoir-faire en packaging verre pour la cosmétique'),
  ('e794326b-77d0-470f-89e0-31fa6eebed83'::uuid, 'SILENT 5, protection auditive sur-mesure réglable'),
  ('224e04da-71ff-4148-a8e6-6804056e3c01'::uuid, 'Stages de voile et privatisation de voilier pour les CSE'),
  ('922c3ef0-7162-48a6-b7b4-238e5aef69dc'::uuid, 'Goulottes SLIMDUCT coloris Anthracite pour tuyauteries CVC'),
  ('c2f7bf7a-8cc9-44ec-9fb1-7e78e639fdf8'::uuid, 'Hélices UAV haute performance conçues en France pour le FPV'),
  ('11bccd4b-310d-41f5-b2f4-cfb4a228b191'::uuid, 'Power Tower CS, access platform for narrow and awkward areas'),
  ('bec1538f-ec19-4588-b685-d28f2f3ebc76'::uuid, 'Cap Camarat 6.0 CC de Jeanneau en avant-première mondiale'),
  ('b5989e70-358d-4130-b96c-a1db93cf21d6'::uuid, 'Usinage de précision : nouvelles géométries d''outils HORN'),
  ('e50c8438-8630-4584-a90e-283fe9be4d37'::uuid, 'Catamaran à voile Fountaine Pajot FP51'),
  ('fd0b570a-341d-4d21-8432-7df6ae199f84'::uuid, 'Voiliers RM890, RM1080 et RM1380 à visiter à flot'),
  ('7eef9ce1-8529-4485-8ef2-a88d77879eef'::uuid, 'Grue sur remorque K350E 100 % électrique'),
  ('aae4340a-50e8-4af0-bf19-05e0a87a5a0e'::uuid, 'Lunettes de luxe en corne de buffle, bois ou or'),
  ('c14de4d5-cb5d-43b0-91cf-d0cb40e163cf'::uuid, 'Yachts Solaris Power 44, 52 et 60 Open et Coupé à quai'),
  ('bfe0c0f2-171a-488b-996c-eeba196c4fd1'::uuid, 'My Star, voilier Dubois de 35 mètres à vendre'),
  ('dcfa0582-c8b4-4177-973b-d6f5ec402ab9'::uuid, 'Aménagement de postes, sièges ergonomiques et exosquelettes');

CREATE TEMP TABLE _avant ON COMMIT DROP AS
  SELECT n.id, n.status, n.title, n.slug FROM public.novelties n JOIN _nouveaux_titres t ON t.id = n.id;

DO $$
DECLARE n_attendu int; n_maj int; n_statut int; n_slug int; n_long int;
BEGIN
  -- service_role le temps de la transaction (sinon protect_novelty_columns dépublie)
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'contexte service_role non pris'; END IF;

  SELECT count(*) INTO n_attendu FROM _nouveaux_titres;
  IF (SELECT count(*) FROM _avant) <> n_attendu THEN RAISE EXCEPTION 'nouveautés introuvables'; END IF;
  IF EXISTS (SELECT 1 FROM public.novelties n JOIN _nouveaux_titres t ON t.id = n.id
             WHERE n.created_by IS DISTINCT FROM (SELECT id FROM auth.users WHERE email = 'admin@lotexpo.com')) THEN
    RAISE EXCEPTION 'une nouveauté de la liste n''a pas été créée par admin@lotexpo.com, arrêt';
  END IF;
  IF EXISTS (SELECT 1 FROM _avant WHERE char_length(title) <= 70) THEN
    RAISE EXCEPTION 'un titre a déjà été modifié depuis la préparation, arrêt';
  END IF;

  UPDATE public.novelties n SET title = t.titre FROM _nouveaux_titres t WHERE t.id = n.id;
  GET DIAGNOSTICS n_maj = ROW_COUNT;

  SELECT count(*) INTO n_statut FROM public.novelties n JOIN _avant a ON a.id = n.id WHERE n.status IS DISTINCT FROM a.status;
  SELECT count(*) INTO n_slug   FROM public.novelties n JOIN _avant a ON a.id = n.id WHERE n.slug   IS DISTINCT FROM a.slug;
  SELECT count(*) INTO n_long   FROM public.novelties n JOIN _nouveaux_titres t ON t.id = n.id WHERE char_length(n.title) > 60;

  IF n_maj <> n_attendu OR n_statut <> 0 OR n_slug <> 0 OR n_long <> 0 THEN
    RAISE EXCEPTION 'contrôle KO : maj=% / attendu=% / statuts changés=% / slugs changés=% / titres de la liste > 60=%', n_maj, n_attendu, n_statut, n_slug, n_long;
  END IF;
END $$;
COMMIT;
