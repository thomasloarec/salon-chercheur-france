-- Mise à jour du logo Stoelzle avec URL de preview
UPDATE exhibitors
SET 
  logo_url = 'https://id-preview--372be6a2-b585-4c8b-8fb0-060089ac0520.lovable.app/logos/stoelzle-logo.jpg',
  updated_at = NOW()
WHERE id = '26153490-a0a3-4f7f-981a-f50dd09efcd4';