-- ============================================================
-- Migration 0004: developers, developer_shares
-- ============================================================

create table developers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact_person  text,
  contact_email   text,
  contact_phone   text,
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references team_members(id)
);

create index on developers (name) where is_active = true;

create table developer_shares (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references assets(id),
  developer_id    uuid not null references developers(id),
  shared_at       timestamptz not null default now(),
  shared_by       uuid not null references team_members(id),
  outcome         text,
  outcome_at      timestamptz,
  notes           text,
  deleted_at      timestamptz,
  deleted_by      uuid references team_members(id),
  unique (asset_id, developer_id)
);

create index on developer_shares (asset_id)     where deleted_at is null;
create index on developer_shares (developer_id) where deleted_at is null;

-- RLS
alter table developers enable row level security;
create policy "developers_read" on developers
  for select using (auth.uid() is not null);
create policy "developers_write" on developers
  for all using (auth.uid() is not null);

alter table developer_shares enable row level security;
create policy "shares_read" on developer_shares
  for select using (auth.uid() is not null and deleted_at is null);
create policy "shares_write" on developer_shares
  for all using (auth.uid() is not null);
