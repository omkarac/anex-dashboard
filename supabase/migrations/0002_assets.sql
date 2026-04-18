-- ============================================================
-- Migration 0002: assets + engagements tables
-- ============================================================

-- Create assets first (without engagement FK to break circular ref)
create table assets (
  id                          uuid primary key default gen_random_uuid(),
  property_name               text not null,
  location                    text,
  status                      asset_status_enum not null default 'new',
  temperature                 asset_temperature_enum not null default 'none',
  asset_type                  asset_type_enum,
  spoc_agent                  text,
  resource                    text,
  handover_notes              text,
  plot_size_sqm               numeric(14,2),
  fsi_potential               numeric(8,3),
  regulations                 text[] default '{}',
  regulation_notes            text,
  development_potential_sqm   numeric(14,2),
  rehab_area_sqm              numeric(14,2),
  sale_area_sqm               numeric(14,2),
  sale_rate_psf               numeric(14,2),
  initial_investment_cr       numeric(14,2),
  profit_cr                   numeric(14,2),
  topline_cr                  numeric(14,2),
  next_step                   text,
  converted_to_engagement_id  uuid,             -- FK added after engagements
  created_at                  timestamptz not null default now(),
  created_by                  uuid not null references team_members(id),
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references team_members(id),
  deleted_at                  timestamptz,
  deleted_by                  uuid references team_members(id)
);

-- Engagements (references assets)
create table engagements (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references assets(id),
  kind        engagement_kind_enum not null,
  started_at  date not null default current_date,
  ended_at    date,
  notes       text,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references team_members(id)
);

-- Now wire the circular FK
alter table assets
  add constraint assets_converted_engagement_fk
  foreign key (converted_to_engagement_id) references engagements(id);

-- Indexes
create index on assets (status) where deleted_at is null;
create index on assets (temperature) where deleted_at is null;
create index on assets (created_by);
create index on assets (converted_to_engagement_id);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_set_updated_at
  before update on assets
  for each row execute function set_updated_at();

-- RLS
alter table assets enable row level security;

create policy "assets_read" on assets
  for select using (auth.uid() is not null and deleted_at is null);

create policy "assets_insert" on assets
  for insert with check (auth.uid() is not null);

create policy "assets_update" on assets
  for update using (auth.uid() is not null);

alter table engagements enable row level security;

create policy "engagements_read" on engagements
  for select using (auth.uid() is not null);

create policy "engagements_insert" on engagements
  for insert with check (auth.uid() is not null);
