-- Jalankan sekali di Supabase > SQL Editor

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('text', 'file')),
  content text,
  file_path text,
  file_name text,
  file_size bigint,
  mime text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.items enable row level security;
create policy "anon akses items" on public.items
  for all to anon using (true) with check (true);

-- aktifkan realtime untuk tabel items
alter publication supabase_realtime add table public.items;

-- bucket file (publik, maksimal 50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('transfer', 'transfer', true, 52428800)
on conflict (id) do nothing;

create policy "anon baca transfer" on storage.objects
  for select to anon using (bucket_id = 'transfer');
create policy "anon unggah transfer" on storage.objects
  for insert to anon with check (bucket_id = 'transfer');
create policy "anon hapus transfer" on storage.objects
  for delete to anon using (bucket_id = 'transfer');
