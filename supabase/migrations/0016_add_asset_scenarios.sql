-- Add asset_scenarios table for multi-scenario feasibility tracking.
-- One asset can have multiple financial scenarios (Base Case, Conservative, Aggressive, etc.)
-- is_primary marks the scenario whose numbers flow to dashboard aggregations.
-- assets.topline_cr and assets.initial_investment_cr are kept as primary-scenario
-- snapshots so all existing dashboard and filter queries work unchanged.

create table asset_scenarios (
  id                        uuid primary key default gen_random_uuid(),
  asset_id                  uuid not null references assets(id) on delete cascade,
  name                      text not null default 'Scenario 1',
  sort_order                integer not null default 0,
  is_primary                boolean not null default false,
  fsi_potential             numeric(8,3),
  development_potential_sqm numeric(14,2),
  rehab_area_sqm            numeric(14,2),
  sale_area_sqm             numeric(14,2),
  sale_rate_psf             numeric(14,2),
  initial_investment_cr     numeric(14,2),
  topline_cr                numeric(14,2),
  profit_cr                 numeric(14,2),
  created_by                uuid references auth.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  deleted_by                uuid references auth.users(id)
);

create index on asset_scenarios (asset_id) where deleted_at is null;

create trigger asset_scenarios_set_updated_at
  before update on asset_scenarios
  for each row execute function set_updated_at();

alter table asset_scenarios enable row level security;

create policy "Authenticated users can manage asset scenarios"
  on asset_scenarios for all to authenticated using (true) with check (true);

-- Seed one primary scenario per existing asset that has any financial data.
-- This preserves all existing feasibility numbers.
insert into asset_scenarios (
  asset_id, name, sort_order, is_primary,
  fsi_potential, development_potential_sqm, rehab_area_sqm,
  sale_area_sqm, sale_rate_psf, initial_investment_cr,
  topline_cr, profit_cr, created_by
)
select
  id, 'Scenario 1', 0, true,
  fsi_potential, development_potential_sqm, rehab_area_sqm,
  sale_area_sqm, sale_rate_psf, initial_investment_cr,
  topline_cr, profit_cr, created_by
from assets
where deleted_at is null
  and (
    fsi_potential             is not null or
    development_potential_sqm is not null or
    rehab_area_sqm            is not null or
    sale_area_sqm             is not null or
    sale_rate_psf             is not null or
    initial_investment_cr     is not null or
    topline_cr                is not null or
    profit_cr                 is not null
  );
