-- ============================================================
-- Migration 0001: Initial schema — team_members + enums
-- ============================================================

-- Enums
create type role_enum as enum ('admin', 'member');
create type asset_status_enum as enum (
  'new',
  'initial_assessment',
  'evaluating',
  'evaluated',
  'shared_with_developer',
  'on_hold',
  'won',
  'dropped'
);
create type asset_temperature_enum as enum ('hot', 'warm', 'cold', 'none');
create type asset_type_enum as enum (
  'redevelopment',
  'outright',
  'jv_jd',
  'sra',
  'mhada_redevelopment',
  'open_land',
  'funding',
  'other'
);
create type engagement_kind_enum as enum ('mandate', 'pmc_pmas');
create type task_status_enum as enum (
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled'
);
create type task_priority_enum as enum ('low', 'medium', 'high', 'urgent');

-- Team members (extends auth.users)
create table team_members (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text not null unique,
  role       role_enum not null default 'member',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed first admin
-- NOTE: Replace this with the actual auth.users id after first login,
-- or use a trigger to auto-promote on first login for this email.
-- The seed script handles this at runtime.

-- RLS
alter table team_members enable row level security;

-- All authenticated users can read team_members
create policy "team_members_read" on team_members
  for select using (auth.uid() is not null);

-- Only admins can insert/update
create policy "team_members_admin_write" on team_members
  for all using (
    exists (
      select 1 from team_members tm
      where tm.id = auth.uid() and tm.role = 'admin'
    )
  );

-- Users can read/update their own row
create policy "team_members_self_update" on team_members
  for update using (id = auth.uid());
