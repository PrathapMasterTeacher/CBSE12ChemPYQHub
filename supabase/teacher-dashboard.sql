begin;

create table if not exists public.caa_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.caa_teachers enable row level security;
revoke all on public.caa_teachers from public, anon, authenticated;
grant select on public.caa_teachers to authenticated;
drop policy if exists caa_teacher_self on public.caa_teachers;
create policy caa_teacher_self on public.caa_teachers for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.caa_practice_attempts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text default (auth.jwt() ->> 'email'),
  quiz text not null check (quiz in ('board-2026', 'practice')),
  question_id text not null check (char_length(question_id) between 1 and 200),
  chapter text not null check (char_length(chapter) between 1 and 200),
  selected smallint not null check (selected between 0 and 15),
  correct boolean not null,
  attempted_at timestamptz not null default now(),
  primary key (user_id, quiz, question_id)
);
create index if not exists caa_attempts_recent on public.caa_practice_attempts (attempted_at desc);
alter table public.caa_practice_attempts enable row level security;
revoke all on public.caa_practice_attempts from public, anon, authenticated;
grant select on public.caa_practice_attempts to authenticated;
grant insert (quiz, question_id, chapter, selected, correct) on public.caa_practice_attempts to authenticated;

drop policy if exists caa_attempts_read on public.caa_practice_attempts;
create policy caa_attempts_read on public.caa_practice_attempts for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.caa_teachers where user_id = (select auth.uid())
  ));
drop policy if exists caa_attempts_write on public.caa_practice_attempts;
create policy caa_attempts_write on public.caa_practice_attempts for insert to authenticated
  with check (user_id = (select auth.uid()));

commit;
