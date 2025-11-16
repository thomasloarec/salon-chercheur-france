-- Table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Type et catégorie
  type TEXT NOT NULL CHECK (type IN (
    'like', 'comment', 'reply', 'new_lead_brochure', 'new_lead_rdv',
    'new_novelty_on_favorite', 'event_reminder_7d', 'event_reminder_1d',
    'novelty_approved', 'novelty_rejected', 'plan_limit_reached',
    'welcome', 'complete_profile', 'password_changed', 'suspicious_activity',
    'recommended_event', 'inactivity_reminder'
  )),
  category TEXT NOT NULL CHECK (category IN (
    'interaction', 'lead', 'favorite_event', 'exhibitor_mgmt', 'system', 'recommendation'
  )),
  
  -- Contenu
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT,
  
  -- Références
  novelty_id UUID REFERENCES novelties(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  exhibitor_id UUID REFERENCES exhibitors(id) ON DELETE SET NULL,
  comment_id UUID,
  lead_id UUID,
  
  -- Émetteur
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  actor_company TEXT,
  actor_avatar_url TEXT,
  
  -- Métadonnées
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  link_url TEXT,
  metadata JSONB,
  
  -- Groupement
  group_key TEXT,
  group_count INTEGER DEFAULT 1,
  
  -- Dates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(group_key) WHERE group_key IS NOT NULL;

-- RLS Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can create notifications" ON notifications;
CREATE POLICY "Service role can create notifications"
ON notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- Modifier table leads existante
-- Ajouter colonnes manquantes si elles n'existent pas
DO $$ 
BEGIN
  -- Ajouter exhibitor_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='exhibitor_id') THEN
    ALTER TABLE leads ADD COLUMN exhibitor_id UUID REFERENCES exhibitors(id) ON DELETE CASCADE;
  END IF;
  
  -- Ajouter event_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='event_id') THEN
    ALTER TABLE leads ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;
  END IF;
  
  -- Ajouter type si n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='type') THEN
    ALTER TABLE leads ADD COLUMN type TEXT CHECK (type IN ('brochure_download', 'rdv_request'));
  END IF;
  
  -- Ajouter user_id si n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='user_id') THEN
    ALTER TABLE leads ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Ajouter lead_name (ou utiliser first_name + last_name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='lead_name') THEN
    ALTER TABLE leads ADD COLUMN lead_name TEXT;
  END IF;
  
  -- Ajouter lead_email (ou renommer email)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='lead_email') THEN
    ALTER TABLE leads ADD COLUMN lead_email TEXT;
  END IF;
  
  -- Ajouter autres colonnes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='lead_company') THEN
    ALTER TABLE leads ADD COLUMN lead_company TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='lead_position') THEN
    ALTER TABLE leads ADD COLUMN lead_position TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='lead_phone') THEN
    ALTER TABLE leads ADD COLUMN lead_phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='message') THEN
    ALTER TABLE leads ADD COLUMN message TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='rdv_date') THEN
    ALTER TABLE leads ADD COLUMN rdv_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='stand_info') THEN
    ALTER TABLE leads ADD COLUMN stand_info TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='status') THEN
    ALTER TABLE leads ADD COLUMN status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='leads' AND column_name='updated_at') THEN
    ALTER TABLE leads ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Créer indexes pour leads
CREATE INDEX IF NOT EXISTS idx_leads_exhibitor ON leads(exhibitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_event ON leads(event_id);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type);
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);

-- RLS Leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Exhibitor owners can view their leads" ON leads;
CREATE POLICY "Exhibitor owners can view their leads"
ON leads FOR SELECT
TO authenticated
USING (
  exhibitor_id IN (
    SELECT id FROM exhibitors WHERE owner_user_id = auth.uid()
  ) OR is_admin()
);

DROP POLICY IF EXISTS "Exhibitor owners can update their leads" ON leads;
CREATE POLICY "Exhibitor owners can update their leads"
ON leads FOR UPDATE
TO authenticated
USING (
  exhibitor_id IN (
    SELECT id FROM exhibitors WHERE owner_user_id = auth.uid()
  ) OR is_admin()
);

DROP POLICY IF EXISTS "Service role can create leads" ON leads;
CREATE POLICY "Service role can create leads"
ON leads FOR INSERT
TO service_role
WITH CHECK (true);

-- Fonction helper count_active_leads
CREATE OR REPLACE FUNCTION count_active_leads(exhibitor_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM leads
  WHERE exhibitor_id = exhibitor_uuid
    AND created_at > NOW() - INTERVAL '30 days';
$$ LANGUAGE SQL STABLE;

-- Trigger pour updated_at sur notifications
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();

-- Trigger pour updated_at sur leads
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_leads_updated_at();