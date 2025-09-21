-- Create storage bucket for novelties files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('novelties', 'novelties', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

-- Create RLS policies for novelties bucket
create policy "Novelty images are publicly accessible" 
on storage.objects 
for select 
using (bucket_id = 'novelties');

create policy "Authenticated users can upload novelty files" 
on storage.objects 
for insert 
with check (bucket_id = 'novelties' AND auth.role() = 'authenticated');

create policy "Users can update their own novelty files" 
on storage.objects 
for update 
using (bucket_id = 'novelties' AND auth.role() = 'authenticated');

create policy "Users can delete their own novelty files" 
on storage.objects 
for delete 
using (bucket_id = 'novelties' AND auth.role() = 'authenticated');