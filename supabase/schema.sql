-- Freelance Flow — run this in the Supabase SQL Editor (once per project).
-- Auth roles live in public.profiles.role, never in auth.users raw_user_meta_data.
-- Closed ecosystem: disable public Email sign-ups in Auth settings.
-- Provision users only via supabase.auth.admin.createUser (service role /api/team).
-- First corporate admin: create the user in the Supabase Auth dashboard so this trigger assigns admin.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'employee');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.user_role not null default 'employee',
  full_name text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check check (status in ('active', 'disabled'));
  end if;
end
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  client_id text,
  client_name text,
  platform text not null
    check (platform in ('Freelancehunt', 'Freelance BG', 'Direct Client', 'Other')),
  gross_amount numeric(14, 2) not null check (gross_amount >= 0),
  currency text not null check (currency in ('EUR', 'USD', 'UAH', 'PLN')),
  custom_fee numeric(14, 2) not null default 0 check (custom_fee >= 0),
  exchange_rate_at_creation numeric(18, 8) not null check (exchange_rate_at_creation > 0),
  date date not null,
  start_date date,
  end_date date,
  payout_date date,
  status text not null
    check (status in ('Pending', 'Paid', 'In Progress')),
  week_number integer not null check (week_number between 1 and 53),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_employee_id_idx on public.projects (employee_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_date_idx on public.projects (date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Invitation-only. First auth.users row becomes admin; later rows are employees.
-- Do not assign role from JWT / raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
begin
  assigned_role := case
    when not exists (select 1 from public.profiles) then 'admin'::public.user_role
    else 'employee'::public.user_role
  end;

  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    assigned_role,
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.has_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.has_admin() from public, anon;
grant execute on function public.has_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create or replace function public.preserve_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_preserve_role on public.profiles;
create trigger profiles_preserve_role
  before update on public.profiles
  for each row execute function public.preserve_profile_role();

-- Employees: own rows only. Admins: all rows.
drop policy if exists "projects_select_own_or_admin" on public.projects;
create policy "projects_select_own_or_admin"
  on public.projects
  for select
  to authenticated
  using (employee_id = auth.uid() or public.is_admin());

drop policy if exists "projects_insert_own_or_admin" on public.projects;
create policy "projects_insert_own_or_admin"
  on public.projects
  for insert
  to authenticated
  with check (employee_id = auth.uid() or public.is_admin());

drop policy if exists "projects_update_own_or_admin" on public.projects;
create policy "projects_update_own_or_admin"
  on public.projects
  for update
  to authenticated
  using (employee_id = auth.uid() or public.is_admin())
  with check (employee_id = auth.uid() or public.is_admin());

drop policy if exists "projects_delete_own_or_admin" on public.projects;
drop policy if exists "projects_delete_admin_only" on public.projects;
create policy "projects_delete_admin_only"
  on public.projects
  for delete
  to authenticated
  using (public.is_admin());

