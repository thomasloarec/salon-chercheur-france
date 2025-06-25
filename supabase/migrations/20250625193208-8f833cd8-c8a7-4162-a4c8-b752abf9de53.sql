
-- Supprimer les tables si elles existent
DROP TABLE IF EXISTS public.communes CASCADE;
DROP TABLE IF EXISTS public.departements CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;

-- Créer la table des régions
CREATE TABLE public.regions (
  code TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table des départements
CREATE TABLE public.departements (
  code TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  region_code TEXT REFERENCES public.regions(code),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table des communes
CREATE TABLE public.communes (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  code_postal TEXT,
  dep_code TEXT REFERENCES public.departements(code),
  region_code TEXT REFERENCES public.regions(code),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insérer les données des régions (18 régions françaises)
INSERT INTO public.regions (code, nom) VALUES
('01', 'Guadeloupe'),
('02', 'Martinique'),
('03', 'Guyane'),
('04', 'La Réunion'),
('06', 'Mayotte'),
('11', 'Île-de-France'),
('24', 'Centre-Val de Loire'),
('27', 'Bourgogne-Franche-Comté'),
('28', 'Normandie'),
('32', 'Hauts-de-France'),
('44', 'Grand Est'),
('52', 'Pays de la Loire'),
('53', 'Bretagne'),
('75', 'Nouvelle-Aquitaine'),
('76', 'Occitanie'),
('84', 'Auvergne-Rhône-Alpes'),
('93', 'Provence-Alpes-Côte d''Azur'),
('94', 'Corse');

-- Insérer les départements (101 départements + collectivités)
INSERT INTO public.departements (code, nom, region_code) VALUES
-- Île-de-France (11)
('75', 'Paris', '11'),
('77', 'Seine-et-Marne', '11'),
('78', 'Yvelines', '11'),
('91', 'Essonne', '11'),
('92', 'Hauts-de-Seine', '11'),
('93', 'Seine-Saint-Denis', '11'),
('94', 'Val-de-Marne', '11'),
('95', 'Val-d''Oise', '11'),
-- Centre-Val de Loire (24)
('18', 'Cher', '24'),
('28', 'Eure-et-Loir', '24'),
('36', 'Indre', '24'),
('37', 'Indre-et-Loire', '24'),
('41', 'Loir-et-Cher', '24'),
('45', 'Loiret', '24'),
-- Bourgogne-Franche-Comté (27)
('21', 'Côte-d''Or', '27'),
('25', 'Doubs', '27'),
('39', 'Jura', '27'),
('58', 'Nièvre', '27'),
('70', 'Haute-Saône', '27'),
('71', 'Saône-et-Loire', '27'),
('89', 'Yonne', '27'),
('90', 'Territoire de Belfort', '27'),
-- Normandie (28)
('14', 'Calvados', '28'),
('27', 'Eure', '28'),
('50', 'Manche', '28'),
('61', 'Orne', '28'),
('76', 'Seine-Maritime', '28'),
-- Hauts-de-France (32)
('02', 'Aisne', '32'),
('59', 'Nord', '32'),
('60', 'Oise', '32'),
('62', 'Pas-de-Calais', '32'),
('80', 'Somme', '32'),
-- Grand Est (44)
('08', 'Ardennes', '44'),
('10', 'Aube', '44'),
('51', 'Marne', '44'),
('52', 'Haute-Marne', '44'),
('54', 'Meurthe-et-Moselle', '44'),
('55', 'Meuse', '44'),
('57', 'Moselle', '44'),
('67', 'Bas-Rhin', '44'),
('68', 'Haut-Rhin', '44'),
('88', 'Vosges', '44'),
-- Pays de la Loire (52)
('44', 'Loire-Atlantique', '52'),
('49', 'Maine-et-Loire', '52'),
('53', 'Mayenne', '52'),
('72', 'Sarthe', '52'),
('85', 'Vendée', '52'),
-- Bretagne (53)
('22', 'Côtes-d''Armor', '53'),
('29', 'Finistère', '53'),
('35', 'Ille-et-Vilaine', '53'),
('56', 'Morbihan', '53'),
-- Nouvelle-Aquitaine (75)
('16', 'Charente', '75'),
('17', 'Charente-Maritime', '75'),
('19', 'Corrèze', '75'),
('23', 'Creuse', '75'),
('24', 'Dordogne', '75'),
('33', 'Gironde', '75'),
('40', 'Landes', '75'),
('47', 'Lot-et-Garonne', '75'),
('64', 'Pyrénées-Atlantiques', '75'),
('79', 'Deux-Sèvres', '75'),
('86', 'Vienne', '75'),
('87', 'Haute-Vienne', '75'),
-- Occitanie (76)
('09', 'Ariège', '76'),
('11', 'Aude', '76'),
('12', 'Aveyron', '76'),
('30', 'Gard', '76'),
('31', 'Haute-Garonne', '76'),
('32', 'Gers', '76'),
('34', 'Hérault', '76'),
('46', 'Lot', '76'),
('48', 'Lozère', '76'),
('65', 'Hautes-Pyrénées', '76'),
('66', 'Pyrénées-Orientales', '76'),
('81', 'Tarn', '76'),
('82', 'Tarn-et-Garonne', '76'),
-- Auvergne-Rhône-Alpes (84)
('01', 'Ain', '84'),
('03', 'Allier', '84'),
('07', 'Ardèche', '84'),
('15', 'Cantal', '84'),
('26', 'Drôme', '84'),
('38', 'Isère', '84'),
('42', 'Loire', '84'),
('43', 'Haute-Loire', '84'),
('63', 'Puy-de-Dôme', '84'),
('69', 'Rhône', '84'),
('73', 'Savoie', '84'),
('74', 'Haute-Savoie', '84'),
-- Provence-Alpes-Côte d'Azur (93)
('04', 'Alpes-de-Haute-Provence', '93'),
('05', 'Hautes-Alpes', '93'),
('06', 'Alpes-Maritimes', '93'),
('13', 'Bouches-du-Rhône', '93'),
('83', 'Var', '93'),
('84', 'Vaucluse', '93'),
-- Corse (94)
('2A', 'Corse-du-Sud', '94'),
('2B', 'Haute-Corse', '94'),
-- DOM-TOM
('971', 'Guadeloupe', '01'),
('972', 'Martinique', '02'),
('973', 'Guyane', '03'),
('974', 'La Réunion', '04'),
('976', 'Mayotte', '06');

-- Créer le trigger de cohérence pour les communes
CREATE OR REPLACE FUNCTION public.ensure_commune_region_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- Récupérer le code région du département
    SELECT region_code INTO NEW.region_code
    FROM public.departements
    WHERE code = NEW.dep_code;
    
    -- Si le département n'existe pas, lever une erreur
    IF NEW.region_code IS NULL THEN
        RAISE EXCEPTION 'Département % introuvable pour la commune %', NEW.dep_code, NEW.nom;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
CREATE TRIGGER trigger_commune_region_consistency
    BEFORE INSERT OR UPDATE ON public.communes
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_commune_region_consistency();

-- Insérer les communes principales (le trigger va automatiquement remplir region_code)
INSERT INTO public.communes (nom, code_postal, dep_code) VALUES
('Paris', '75000', '75'),
('Marseille', '13000', '13'),
('Lyon', '69000', '69'),
('Toulouse', '31000', '31'),
('Nice', '06000', '06'),
('Nantes', '44000', '44'),
('Montpellier', '34000', '34'),
('Strasbourg', '67000', '67'),
('Bordeaux', '33000', '33'),
('Lille', '59000', '59'),
('Rennes', '35000', '35'),
('Reims', '51100', '51'),
('Saint-Étienne', '42000', '42'),
('Le Havre', '76600', '76'),
('Toulon', '83000', '83'),
('Grenoble', '38000', '38'),
('Dijon', '21000', '21'),
('Angers', '49000', '49'),
('Nîmes', '30000', '30'),
('Villeurbanne', '69100', '69'),
('Saint-Denis', '93200', '93'),
('Le Mans', '72000', '72'),
('Aix-en-Provence', '13100', '13'),
('Clermont-Ferrand', '63000', '63'),
('Brest', '29200', '29'),
('Limoges', '87000', '87'),
('Tours', '37000', '37'),
('Amiens', '80000', '80'),
('Perpignan', '66000', '66'),
('Metz', '57000', '57'),
('Besançon', '25000', '25'),
('Orléans', '45000', '45'),
('Mulhouse', '68100', '68'),
('Rouen', '76000', '76'),
('Pau', '64000', '64'),
('Caen', '14000', '14'),
('La Rochelle', '17000', '17'),
('Calais', '62100', '62'),
('Cannes', '06400', '06'),
('Annecy', '74000', '74'),
('Troyes', '10000', '10'),
('Lorient', '56100', '56'),
('Bourges', '18000', '18'),
('Chambéry', '73000', '73'),
('Saint-Nazaire', '44600', '44'),
('Valence', '26000', '26'),
('Quimper', '29000', '29'),
('Blois', '41000', '41'),
('Chartres', '28000', '28'),
('Châlons-en-Champagne', '51000', '51'),
('Angoulême', '16000', '16'),
('Poitiers', '86000', '86'),
('Dunkerque', '59140', '59'),
('Bayonne', '64100', '64'),
('Colmar', '68000', '68'),
('Arras', '62000', '62'),
('Charleville-Mézières', '08000', '08'),
('Châteauroux', '36000', '36'),
('Cholet', '49300', '49'),
('Compiègne', '60200', '60'),
('Draguignan', '83300', '83'),
('Épinal', '88000', '88'),
('Évreux', '27000', '27'),
('Gap', '05000', '05'),
('Laval', '53000', '53'),
('Lons-le-Saunier', '39000', '39'),
('Mâcon', '71000', '71'),
('Melun', '77000', '77'),
('Montauban', '82000', '82'),
('Nevers', '58000', '58'),
('Niort', '79000', '79'),
('Périgueux', '24000', '24'),
('Privas', '07000', '07'),
('Rodez', '12000', '12'),
('Saint-Brieuc', '22000', '22'),
('Saint-Lô', '50000', '50'),
('Tarbes', '65000', '65'),
('Thonon-les-Bains', '74200', '74'),
('Vannes', '56000', '56'),
('Vesoul', '70000', '70'),
('Vienne', '38200', '38'),
('Pointe-à-Pitre', '97110', '971'),
('Fort-de-France', '97200', '972'),
('Cayenne', '97300', '973'),
('Saint-Denis', '97400', '974'),
('Mamoudzou', '97600', '976'),
('Ajaccio', '20000', '2A'),
('Bastia', '20200', '2B');

-- Créer les extensions et index trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_communes_nom_trgm ON public.communes USING gin (nom gin_trgm_ops);
CREATE INDEX idx_departements_nom_trgm ON public.departements USING gin (nom gin_trgm_ops);
CREATE INDEX idx_regions_nom_trgm ON public.regions USING gin (nom gin_trgm_ops);

-- Index pour les performances
CREATE INDEX idx_communes_dep_code ON public.communes(dep_code);
CREATE INDEX idx_communes_region_code ON public.communes(region_code);
CREATE INDEX idx_departements_region_code ON public.departements(region_code);
