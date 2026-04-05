
DROP POLICY "Service role can create leads" ON leads;
CREATE POLICY "Service role can create leads"
ON leads FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY "Service role can create notifications" ON notifications;
CREATE POLICY "Service role can create notifications"
ON notifications FOR INSERT
WITH CHECK (auth.role() = 'service_role');
