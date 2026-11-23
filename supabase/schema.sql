-- AI Teacher Office — skema Supabase (PostgreSQL)
-- Jalankan di Supabase Dashboard > SQL Editor. Setiap baris dimiliki satu guru (owner_id) dan dilindungi RLS.

create table if not exists public.users (        -- profil guru (auth.users tetap menyimpan kredensial)
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists public.classes (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null
);
create table if not exists public.subjects (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null
);
create table if not exists public.students (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null, nis text not null default ''
);
create table if not exists public.attendance (
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null, status text not null check (status in ('H','S','I','A')),
  primary key (student_id, date)
);
create table if not exists public.grades (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  type text not null check (type in ('tugas','ujian','praktik')), title text not null,
  score numeric not null check (score between 0 and 100)
);
create table if not exists public.final_grades (   -- nilai final yang DISETUJUI guru
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  score numeric not null check (score between 0 and 100), approved_at bigint not null,
  primary key (student_id, subject_id)
);
create table if not exists public.assignments (    -- kuis / ujian PG dengan kunci jawaban
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null, answer_key text[] not null
);
create table if not exists public.assignment_submissions (
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  quiz_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers text[] not null, correct int not null, score numeric not null,
  status text not null check (status in ('recommended','approved')), approved_score numeric,
  primary key (quiz_id, student_id)
);
create table if not exists public.ai_agents (      -- katalog pekerja AI (baca-saja)
  id text primary key, name text not null, title text not null, room text not null, description text
);
create table if not exists public.ai_tasks (
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  code text not null, title text not null, agent_id text not null references public.ai_agents(id),
  created_at bigint not null, deadline bigint not null,
  priority text not null check (priority in ('low','normal','high')),
  status text not null check (status in ('pending','in_progress','needs_approval','completed','failed')),
  result text, group_id text, attachment_name text,
  primary key (owner_id, code)
);
create table if not exists public.ai_task_logs (
  id text primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  task_code text not null, at bigint not null, text text not null,
  foreign key (owner_id, task_code) references public.ai_tasks(owner_id, code) on delete cascade
);
create table if not exists public.generated_documents (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null, kind text not null, agent_id text not null,
  class_id uuid references public.classes(id) on delete set null, subject text,
  created_at bigint not null, content text not null, doc_table jsonb
);
create table if not exists public.document_archives (  -- berkas asli yang diunggah guru (isi di Storage bucket "uploads")
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null, size bigint not null, mime text not null, storage_path text not null,
  created_at bigint not null
);

insert into public.ai_agents (id, name, title, room, description) values
 ('manager','Maya','AI Office Manager','Director Room','Membagi tugas dan memantau progres'),
 ('administrator','Adi','AI Administrator','Administration Room','Data siswa, kelas, dokumen administrasi'),
 ('attendance','Ayu','AI Attendance','Attendance Room','Rekap absensi'),
 ('grading','Gilang','AI Grading','Grading Room','Rekap dan rata-rata nilai'),
 ('checker','Citra','AI Checker','Examination Room','Koreksi jawaban'),
 ('content','Kirana','AI Content Creator','Learning Studio','Materi pembelajaran'),
 ('assignment','Arga','AI Assignment Creator','Assignment Studio','Soal dan kuis'),
 ('reporting','Rani','AI Reporting','Reporting Room','Laporan akademik'),
 ('archivist','Arka','AI Archivist','Archive Room','Arsip dokumen')
on conflict (id) do nothing;

-- RLS: guru hanya melihat/mengubah baris miliknya.
do $$
declare t text;
begin
  foreach t in array array['classes','subjects','students','attendance','grades','final_grades','assignments',
    'assignment_submissions','ai_tasks','ai_task_logs','generated_documents','document_archives'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

alter table public.users enable row level security;
drop policy if exists self_all on public.users;
create policy self_all on public.users for all using (id = auth.uid()) with check (id = auth.uid());

alter table public.ai_agents enable row level security;
drop policy if exists agents_read on public.ai_agents;
create policy agents_read on public.ai_agents for select using (auth.role() = 'authenticated');

-- Storage: buat bucket privat "uploads", lalu jalankan:
insert into storage.buckets (id, name, public) values ('uploads','uploads', false) on conflict (id) do nothing;
drop policy if exists uploads_owner on storage.objects;
create policy uploads_owner on storage.objects for all
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- === Migrasi 002 (koreksi esai) ===
create table if not exists public.essay_checks (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null, question text not null, rubric text not null,
  items jsonb not null default '[]'::jsonb   -- [{studentId, answer, status, score, feedback, approvedScore}]
);
alter table public.essay_checks enable row level security;
drop policy if exists owner_all on public.essay_checks;
create policy owner_all on public.essay_checks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
