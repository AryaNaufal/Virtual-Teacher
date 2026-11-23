-- Migrasi 002: koreksi esai (AI Checker). Jalankan di Supabase SQL Editor jika proyek dibuat dari schema.sql versi sebelumnya.
create table if not exists public.essay_checks (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null, question text not null, rubric text not null,
  items jsonb not null default '[]'::jsonb   -- [{studentId, answer, status, score, feedback, approvedScore}]
);
alter table public.essay_checks enable row level security;
drop policy if exists owner_all on public.essay_checks;
create policy owner_all on public.essay_checks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
