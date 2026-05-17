-- Developer appetite / preference profile.
-- One row per developer (1:1), upserted from the UI.
-- Micro-markets stored as canonical slugs to support future geo-matching / Maps.

create table developer_preferences (
  developer_id                  uuid primary key references developers(id) on delete cascade,
  preferred_micro_markets       text[] not null default '{}',
  preferred_asset_types         text[] not null default '{}',
  preferred_regulations         text[] not null default '{}',
  plot_size_min_sqm             numeric(14,2),
  plot_size_max_sqm             numeric(14,2),
  topline_min_cr                numeric(14,2),
  topline_max_cr                numeric(14,2),
  initial_investment_min_cr     numeric(14,2),
  initial_investment_max_cr     numeric(14,2),
  development_potential_min_sqm numeric(14,2),
  development_potential_max_sqm numeric(14,2),
  appetite_notes                text,
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid references team_members(id)
);
