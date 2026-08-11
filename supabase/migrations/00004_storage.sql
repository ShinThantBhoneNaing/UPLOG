-- ============================================================
-- UPLOG · 00004 · Storage: task attachments bucket
-- ============================================================

-- Private bucket; downloads go through short-lived signed URLs.
-- Size/type limits enforced by the bucket itself AND validated in the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  20 * 1024 * 1024, -- 20 MB
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
    'application/zip', 'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Objects are stored as: <uploader_uuid>/<task_uuid>/<random>-<filename>
create policy "attachments bucket: team reads"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and public.is_active_user());

create policy "attachments bucket: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "attachments bucket: uploader or manager deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_active_user()
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_manager_or_admin())
  );

-- Avatars: small public bucket, one folder per user.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 3 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "avatars bucket: anyone reads"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars bucket: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars bucket: replace own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars bucket: delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
