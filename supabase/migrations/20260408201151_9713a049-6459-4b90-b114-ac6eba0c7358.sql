INSERT INTO public.user_roles (user_id, role) 
VALUES ('190cc989-77bc-4b66-ba88-4eb7802a7c2d', 'admin')
ON CONFLICT DO NOTHING;