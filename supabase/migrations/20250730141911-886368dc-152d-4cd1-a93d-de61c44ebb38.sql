CREATE OR REPLACE FUNCTION public.get_user_crm_matches(p_user_id uuid)
 RETURNS TABLE(
   company_id uuid,
   company_name text,
   company_website text,
   provider text,
   events_count integer,
   upcoming_events jsonb
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as company_id,
    c.name as company_name,
    c.website as company_website,
    ucc.provider,
    COUNT(e.id)::int as events_count,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', e.id,
          'nom_event', e.nom_event,
          'date_debut', e.date_debut,
          'ville', e.ville
        ) ORDER BY e.date_debut ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::jsonb
    ) as upcoming_events
  FROM user_crm_companies ucc
  JOIN companies c ON c.id = ucc.company_id
  LEFT JOIN participation p ON LOWER(TRIM(p.website_exposant)) = LOWER(TRIM(c.website))
  LEFT JOIN events e ON e.id_event = p.id_event 
    AND e.visible = true 
    AND e.date_debut >= CURRENT_DATE
  WHERE ucc.user_id = p_user_id
  GROUP BY c.id, c.name, c.website, ucc.provider
  ORDER BY c.name;
END;
$function$