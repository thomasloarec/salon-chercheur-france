-- Mise à jour du logo Stoelzle avec URL depuis le site publié
UPDATE exhibitors
SET 
  logo_url = 'https://lotexpo.lovable.app/logos/stoelzle-logo.jpg',
  updated_at = NOW()
WHERE id = '26153490-a0a3-4f7f-981a-f50dd09efcd4';