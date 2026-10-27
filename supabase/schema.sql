-- =====================================================================================
-- HelixBoard By Mr. Hany Taha — accounts, usage and quiz results (Supabase / Postgres)
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again: everything is created "if not exists" or replaced.
-- =====================================================================================

-- ---------- profiles: one row per account ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9._-]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  role         text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  school       text check (char_length(school) <= 80),
  grade        text check (char_length(grade) <= 30),
  contact_email text check (char_length(contact_email) <= 120),
  platform     text check (char_length(platform) <= 40),
  app_version  text check (char_length(app_version) <= 20),
  created_at   timestamptz not null default now(),
  last_active  timestamptz not null default now()
);

-- ---------- activity: what people use (one row per event) ----------
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind       text not null check (kind ~ '^[a-z_]{2,30}$'),
  detail     jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 4096),
  created_at timestamptz not null default now()
);
create index if not exists activity_user_time on public.activity (user_id, created_at desc);
create index if not exists activity_time on public.activity (created_at desc);

-- ---------- quiz results: practice quizzes, homework and phone quizzes ----------
create table if not exists public.quiz_results (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  mode       text not null check (mode in ('practice', 'homework', 'phone', 'flashcards')),
  set_name   text not null check (char_length(set_name) <= 120),
  score      int  not null check (score >= 0),
  total      int  not null check (total >= 0 and score <= total),
  detail     jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 16384),
  created_at timestamptz not null default now()
);
create index if not exists quiz_user_time on public.quiz_results (user_id, created_at desc);

-- ---------- who is the admin ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- a profile is created with every new account (from the sign-up form) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, username, display_name, role, school, grade, contact_email, platform, app_version)
  values (
    new.id,
    lower(coalesce(m->>'username', split_part(new.email, '@', 1))),
    coalesce(nullif(m->>'display_name', ''), m->>'username', 'User'),
    -- nobody can sign up as admin; only teacher or student
    case when m->>'role' = 'teacher' then 'teacher' else 'student' end,
    nullif(m->>'school', ''), nullif(m->>'grade', ''), nullif(m->>'contact_email', ''),
    nullif(m->>'platform', ''), nullif(m->>'app_version', '')
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- people may change their own name, school and grade — never their role or username ----------
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- app users (signed in) cannot change role or username unless they are the admin;
  -- the SQL Editor (no signed-in user) can, which is how the first admin is made
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.username := old.username;
  end if;
  new.id := old.id; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- ---------- "I am here": updates last active, platform and version ----------
create or replace function public.touch(p_platform text default null, p_version text default null) returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_active = now(),
    platform = coalesce(left(p_platform, 40), platform), app_version = coalesce(left(p_version, 20), app_version)
  where id = auth.uid();
$$;

-- ---------- is a username free? (sign-up form) ----------
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- ---------- row level security ----------
alter table public.profiles     enable row level security;
alter table public.activity     enable row level security;
alter table public.quiz_results enable row level security;

drop policy if exists "own profile or admin" on public.profiles;
create policy "own profile or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "update own profile or admin" on public.profiles;
create policy "update own profile or admin" on public.profiles for update using (id = auth.uid() or public.is_admin());
drop policy if exists "admin deletes profiles" on public.profiles;
create policy "admin deletes profiles" on public.profiles for delete using (public.is_admin());

drop policy if exists "own activity or admin" on public.activity;
create policy "own activity or admin" on public.activity for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "add own activity" on public.activity;
create policy "add own activity" on public.activity for insert with check (user_id = auth.uid());

drop policy if exists "own results or admin" on public.quiz_results;
create policy "own results or admin" on public.quiz_results for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "add own results" on public.quiz_results;
create policy "add own results" on public.quiz_results for insert with check (user_id = auth.uid());

-- ---------- the admin page: one row per user with usage totals (admin only) ----------
create or replace function public.admin_users()
returns table (id uuid, username text, display_name text, role text, school text, grade text, contact_email text, platform text, app_version text,
               created_at timestamptz, last_active timestamptz, sessions bigint, events_7d bigint, quizzes bigint, avg_pct numeric, last_quiz timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.role, p.school, p.grade, p.contact_email, p.platform, p.app_version, p.created_at, p.last_active,
    (select count(*) from activity a where a.user_id = p.id and a.kind = 'open'),
    (select count(*) from activity a where a.user_id = p.id and a.created_at > now() - interval '7 days'),
    (select count(*) from quiz_results q where q.user_id = p.id),
    (select round(avg(100.0 * q.score / nullif(q.total, 0)), 0) from quiz_results q where q.user_id = p.id),
    (select max(q.created_at) from quiz_results q where q.user_id = p.id)
  from profiles p
  where public.is_admin()
  order by p.last_active desc;
$$;

-- ---------- what is used most (admin only) ----------
create or replace function public.admin_usage(p_days int default 30)
returns table (kind text, events bigint, people bigint)
language sql stable security definer set search_path = public as $$
  select a.kind, count(*), count(distinct a.user_id) from activity a
  where public.is_admin() and a.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  group by a.kind order by 2 desc;
$$;

-- ---------- the admin sets a new password for someone who forgot theirs ----------
create or replace function public.admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can reset passwords'; end if;
  if char_length(p_password) < 6 then raise exception 'The password must have at least 6 characters'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- ---------- the admin changes someone's role (student / teacher / admin) ----------
create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can change roles'; end if;
  if p_role not in ('student', 'teacher', 'admin') then raise exception 'Unknown role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- functions that only signed-in people may call
revoke all on function public.touch(text, text), public.admin_users(), public.admin_usage(int), public.admin_set_password(uuid, text), public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.touch(text, text), public.admin_users(), public.admin_usage(int), public.admin_set_password(uuid, text), public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- =====================================================================================
-- AFTER you have created your own account in HelixBoard, make yourself the admin.
-- Replace the username below with yours, select ONLY this line and press Run:
--
--   update public.profiles set role = 'admin' where username = 'your-username';
-- =====================================================================================
