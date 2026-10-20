drop policy if exists agent_photos_delete_own on storage.objects;

create policy agent_photos_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agent-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
