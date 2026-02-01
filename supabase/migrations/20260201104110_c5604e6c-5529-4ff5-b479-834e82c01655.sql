-- Mise à jour du logo pour Stoelzle
UPDATE exhibitors
SET 
  logo_url = 'https://vxivdvzzhebobveedxbj.supabase.co/storage/v1/object/public/avatars/stoelzle-logo.jpg',
  updated_at = NOW()
WHERE id = '26153490-a0a3-4f7f-981a-f50dd09efcd4';