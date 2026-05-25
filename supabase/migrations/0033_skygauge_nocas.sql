-- 0033_skygauge_nocas.sql
-- Skygauge (MMR pre-NOCAS height tool) — NOC data layer for the empirical analysis.
--
-- Self-contained and additive: introduces only new `skygauge`-domain tables,
-- functions, and policies. It does NOT touch any dashboard table or the shared
-- `set_updated_at()` function (skygauge uses its own `skygauge_set_updated_at()`).
--
-- Derived from skygauge/db/schema.sql + skygauge/db/seed_airports.sql, with three
-- deliberate changes for this environment:
--   1. `site_elevation_m` and `permissible_top_raw` are NULLABLE — the historical
--      Maitree backfill legitimately lacks them (~22% / ~10% of records).
--   2. Trigger helper is namespaced `skygauge_set_updated_at()` so it can't clobber
--      the dashboard's existing `set_updated_at()`.
--   3. PostGIS lives in the `extensions` schema (Supabase convention) and every
--      PostGIS type/function is schema-qualified, so resolution never depends on
--      the caller's search_path.

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists postgis with schema extensions;

-- ============================================================================
-- Airports (MMR config)
-- ============================================================================

create table if not exists airports (
    id              serial primary key,
    code            varchar(8)   not null unique,
    name            varchar(128) not null,
    aai_id          integer      not null unique,
    arp_lat         numeric(10, 7) not null,
    arp_lon         numeric(10, 7) not null,
    arp_geom        extensions.geography(point, 4326) generated always as (
                        extensions.st_setsrid(extensions.st_makepoint(arp_lon::float8, arp_lat::float8), 4326)::extensions.geography
                    ) stored,
    elevation_m     numeric(6, 2) not null,
    ols_code        varchar(8)   not null default '4-PA',
    runways         jsonb        not null default '[]'::jsonb,
    active          boolean      not null default true,
    notes           text,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now()
);

comment on table airports is 'MMR airport configuration including ARP, runways, and AAI dropdown ID for scraping.';

-- ============================================================================
-- Issued NOCs (scraped from AAI NOCAS public endpoint / Maitree backfill)
-- ============================================================================

create table if not exists noc_issued (
    noc_id              varchar(64)  primary key,
    sacfa_id            varchar(64),
    airport_id          integer      not null references airports(id),

    lat                 numeric(10, 7) not null,
    lon                 numeric(10, 7) not null,
    geom                extensions.geography(point, 4326) generated always as (
                            extensions.st_setsrid(extensions.st_makepoint(lon::float8, lat::float8), 4326)::extensions.geography
                        ) stored,

    site_elevation_m    numeric(8, 3),                       -- NULLABLE: ~22% of backfill lacks it
    permissible_top_m   numeric(8, 3),
    permissible_top_raw text,                                -- NULLABLE: ~10% of backfill lacks it
    is_restricted       boolean      not null default false,

    structure_type      char(1)      not null check (structure_type in ('B','M','P')),
    status              varchar(16)  not null default 'ISSUED',
    issue_date          date,
    issue_date_known    boolean      not null default false,

    pdf_url             text,
    owner_name          text,
    site_address        text,

    raw_payload         jsonb,
    scraped_at          timestamptz  not null default now(),
    created_at          timestamptz  not null default now(),
    updated_at          timestamptz  not null default now()
);

comment on table noc_issued is 'Issued NOC records (AAI NOCAS + Maitree backfill). Keyed on AAI NOC ID for idempotent upserts.';
comment on column noc_issued.permissible_top_m is 'Parsed numeric value from permissible_top_raw. NULL if absent/parse failed.';
comment on column noc_issued.is_restricted is 'True if the AAI string contained "Restricted" — conditional approval.';

-- ============================================================================
-- Appeal cases (Appellate Committee Meeting Minutes — populated in a later slice)
-- ============================================================================

create table if not exists appeal_case (
    id                          serial primary key,
    noc_id                      varchar(64),
    meeting_date                date         not null,
    item_no                     integer,

    lat                         numeric(10, 7),
    lon                         numeric(10, 7),
    geom                        extensions.geography(point, 4326) generated always as (
                                    case when lat is not null and lon is not null then
                                        extensions.st_setsrid(extensions.st_makepoint(lon::float8, lat::float8), 4326)::extensions.geography
                                    else null end
                                ) stored,

    site_elevation_m            numeric(8, 3),
    approved_top_m              numeric(8, 3),
    approved_top_raw            text,
    decision_text               text,

    pdf_url                     text         not null,
    raw_payload                 jsonb,
    parse_confidence            varchar(16)  not null default 'auto'
                                check (parse_confidence in ('auto','manual','flagged')),
    parsed_at                   timestamptz  not null default now(),
    created_at                  timestamptz  not null default now(),
    updated_at                  timestamptz  not null default now()
);

comment on table appeal_case is 'Appellate Committee cases. parse_confidence=flagged means human review needed.';

-- ============================================================================
-- Scrape log (observability)
-- ============================================================================

create table if not exists scrape_log (
    id                  uuid primary key default gen_random_uuid(),
    scraper             varchar(32)  not null,
    airport_id          integer      references airports(id),
    structure_type      char(1),
    from_date           date,
    to_date             date,

    started_at          timestamptz  not null default now(),
    completed_at        timestamptz,
    duration_ms         integer,
    status              varchar(16)  not null default 'running'
                        check (status in ('running','success','partial','failed')),

    records_added       integer      not null default 0,
    records_updated     integer      not null default 0,
    records_skipped     integer      not null default 0,
    errors              integer      not null default 0,
    error_details       jsonb,
    notes               text
);

comment on table scrape_log is 'Per-run observability for ingestion jobs.';

-- ============================================================================
-- DEM cache (optional — site elevation lookups; v2)
-- ============================================================================

create table if not exists site_elevation_cache (
    lat_rounded     numeric(8, 5) not null,
    lon_rounded     numeric(8, 5) not null,
    elevation_m     numeric(8, 3) not null,
    source          varchar(32)   not null,
    fetched_at      timestamptz   not null default now(),
    primary key (lat_rounded, lon_rounded)
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists noc_issued_geom_idx       on noc_issued       using gist (geom);
create index if not exists appeal_case_geom_idx      on appeal_case      using gist (geom);
create index if not exists airports_arp_geom_idx     on airports         using gist (arp_geom);

create index if not exists noc_issued_airport_idx    on noc_issued       (airport_id);
create index if not exists noc_issued_issue_date_idx on noc_issued       (issue_date desc nulls last);
create index if not exists noc_issued_structure_idx  on noc_issued       (structure_type);
create index if not exists appeal_case_meeting_idx   on appeal_case      (meeting_date desc);
create index if not exists scrape_log_started_idx    on scrape_log       (started_at desc);

-- ============================================================================
-- updated_at trigger (namespaced — does NOT touch dashboard's set_updated_at)
-- ============================================================================

create or replace function skygauge_set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists noc_issued_updated_at  on noc_issued;
drop trigger if exists appeal_case_updated_at on appeal_case;
drop trigger if exists airports_updated_at    on airports;

create trigger noc_issued_updated_at
    before update on noc_issued
    for each row execute function skygauge_set_updated_at();

create trigger appeal_case_updated_at
    before update on appeal_case
    for each row execute function skygauge_set_updated_at();

create trigger airports_updated_at
    before update on airports
    for each row execute function skygauge_set_updated_at();

-- ============================================================================
-- RPC: nearby_nocs
-- ============================================================================

create or replace function nearby_nocs(
    q_lat       float8,
    q_lon       float8,
    radius_m    float8 default 500,
    max_results integer default 100
)
returns table (
    noc_id              varchar(64),
    distance_m          float8,
    lat                 numeric,
    lon                 numeric,
    site_elevation_m    numeric,
    permissible_top_m   numeric,
    is_restricted       boolean,
    structure_type      char(1),
    issue_date          date,
    pdf_url             text
)
language sql stable as $$
    select
        n.noc_id,
        extensions.st_distance(n.geom, extensions.st_setsrid(extensions.st_makepoint(q_lon, q_lat), 4326)::extensions.geography) as distance_m,
        n.lat,
        n.lon,
        n.site_elevation_m,
        n.permissible_top_m,
        n.is_restricted,
        n.structure_type,
        n.issue_date,
        n.pdf_url
    from noc_issued n
    where extensions.st_dwithin(n.geom, extensions.st_setsrid(extensions.st_makepoint(q_lon, q_lat), 4326)::extensions.geography, radius_m)
    order by distance_m asc
    limit max_results
$$;

comment on function nearby_nocs is 'Issued NOCs within radius_m metres of (lat, lon), sorted by distance. Uses GIST spatial index.';

-- ============================================================================
-- RPC: nearby_appeals
-- ============================================================================

create or replace function nearby_appeals(
    q_lat       float8,
    q_lon       float8,
    radius_m    float8 default 1000,
    max_results integer default 50
)
returns table (
    id                          integer,
    noc_id                      varchar(64),
    distance_m                  float8,
    meeting_date                date,
    lat                         numeric,
    lon                         numeric,
    site_elevation_m            numeric,
    approved_top_m              numeric,
    approved_top_raw            text,
    pdf_url                     text
)
language sql stable as $$
    select
        a.id,
        a.noc_id,
        extensions.st_distance(a.geom, extensions.st_setsrid(extensions.st_makepoint(q_lon, q_lat), 4326)::extensions.geography) as distance_m,
        a.meeting_date,
        a.lat,
        a.lon,
        a.site_elevation_m,
        a.approved_top_m,
        a.approved_top_raw,
        a.pdf_url
    from appeal_case a
    where a.geom is not null
      and extensions.st_dwithin(a.geom, extensions.st_setsrid(extensions.st_makepoint(q_lon, q_lat), 4326)::extensions.geography, radius_m)
    order by distance_m asc
    limit max_results
$$;

comment on function nearby_appeals is 'Appellate Committee cases within radius_m metres of (lat, lon).';

-- ============================================================================
-- RPC: noc_neighborhood_stats — the empirical band
-- ============================================================================

create or replace function noc_neighborhood_stats(
    q_lat    float8,
    q_lon    float8,
    radius_m float8 default 500
)
returns table (
    total_count             bigint,
    median_permissible_top  numeric,
    min_permissible_top     numeric,
    max_permissible_top     numeric,
    median_recent_5y        numeric,
    most_recent_issue       date,
    restricted_count        bigint,
    appeal_count_within_1km bigint
)
language sql stable as $$
    with nearby as (
        select n.permissible_top_m, n.is_restricted, n.issue_date
        from noc_issued n
        where extensions.st_dwithin(n.geom, extensions.st_setsrid(extensions.st_makepoint(q_lon, q_lat), 4326)::extensions.geography, radius_m)
          and n.permissible_top_m is not null
    ),
    recent as (
        select permissible_top_m
        from nearby
        where issue_date >= (current_date - interval '5 years')
    ),
    appeals as (
        select count(*) as c
        from appeal_case a
        where a.geom is not null
          and extensions.st_dwithin(a.geom, extensions.st_setsrid(extensions.st_makepoint(q_lon, q_lat), 4326)::extensions.geography, 1000)
    )
    select
        (select count(*) from nearby)                                          as total_count,
        (select percentile_cont(0.5) within group (order by permissible_top_m)
         from nearby)                                                          as median_permissible_top,
        (select min(permissible_top_m) from nearby)                            as min_permissible_top,
        (select max(permissible_top_m) from nearby)                            as max_permissible_top,
        (select percentile_cont(0.5) within group (order by permissible_top_m)
         from recent)                                                          as median_recent_5y,
        (select max(issue_date) from nearby)                                   as most_recent_issue,
        (select count(*) from nearby where is_restricted)                      as restricted_count,
        (select c from appeals)                                                as appeal_count_within_1km
$$;

comment on function noc_neighborhood_stats is 'One-shot statistical summary of nearby NOCs for the empirical analyzer.';

-- ============================================================================
-- Row-level security — the AAI data is public; expose read, gate writes
-- ============================================================================

alter table airports             enable row level security;
alter table noc_issued           enable row level security;
alter table appeal_case          enable row level security;
alter table scrape_log           enable row level security;
alter table site_elevation_cache enable row level security;

drop policy if exists "skygauge public read airports"    on airports;
drop policy if exists "skygauge public read noc_issued"  on noc_issued;
drop policy if exists "skygauge public read appeal_case" on appeal_case;

create policy "skygauge public read airports"    on airports    for select using (true);
create policy "skygauge public read noc_issued"  on noc_issued  for select using (true);
create policy "skygauge public read appeal_case" on appeal_case for select using (true);
-- scrape_log + site_elevation_cache: RLS enabled, no policies => service-role only.

grant select on airports, noc_issued, appeal_case to anon, authenticated;
grant execute on function nearby_nocs(float8, float8, float8, integer)        to anon, authenticated;
grant execute on function nearby_appeals(float8, float8, float8, integer)     to anon, authenticated;
grant execute on function noc_neighborhood_stats(float8, float8, float8)      to anon, authenticated;

-- ============================================================================
-- Seed: MMR airports (idempotent on code)
-- ============================================================================

insert into airports (code, name, aai_id, arp_lat, arp_lon, elevation_m, ols_code, runways, active, notes)
values
    (
        'VABB',
        'Chhatrapati Shivaji Maharaj International Airport (Santa Cruz)',
        15, 19.0916944, 72.8654722, 11.28, '4-PA',
        jsonb_build_array(
            jsonb_build_object(
                'designator', '09/27',
                'threshold_a', jsonb_build_object('name','09','lat',19.0931,'lon',72.8516,'elev_m',11.0),
                'threshold_b', jsonb_build_object('name','27','lat',19.0857,'lon',72.8836,'elev_m',9.5),
                'length_m', 3445, 'width_m', 60, 'true_bearing', 92.1, 'surface', 'asphalt'
            ),
            jsonb_build_object(
                'designator', '14/32',
                'threshold_a', jsonb_build_object('name','14','lat',19.1022,'lon',72.8641,'elev_m',8.5),
                'threshold_b', jsonb_build_object('name','32','lat',19.0793,'lon',72.8836,'elev_m',10.7),
                'length_m', 2925, 'width_m', 45, 'true_bearing', 142.6, 'surface', 'asphalt'
            )
        ),
        true,
        'Primary MMR airport. Both runways are precision-approach Code 4. ARP per AAI eAIP.'
    ),
    (
        'VAJJ',
        'Juhu Aerodrome',
        16, 19.0967, 72.8347, 4.5, '2-NPA',
        jsonb_build_array(
            jsonb_build_object(
                'designator', '08/26',
                'threshold_a', jsonb_build_object('name','08','lat',19.0966,'lon',72.8311,'elev_m',4.5),
                'threshold_b', jsonb_build_object('name','26','lat',19.0968,'lon',72.8389,'elev_m',4.5),
                'length_m', 1143, 'width_m', 23, 'true_bearing', 79.5, 'surface', 'asphalt'
            ),
            jsonb_build_object(
                'designator', '03/21',
                'threshold_a', jsonb_build_object('name','03','lat',19.0950,'lon',72.8334,'elev_m',4.5),
                'threshold_b', jsonb_build_object('name','21','lat',19.0982,'lon',72.8361,'elev_m',4.5),
                'length_m', 700, 'width_m', 23, 'true_bearing', 33.5, 'surface', 'asphalt'
            )
        ),
        true,
        'General aviation. Smaller OLS footprint than CSMIA. Code 2 non-precision.'
    ),
    (
        'VANM',
        'Navi Mumbai International Airport',
        140, 19.0567, 73.0250, 3.0, '4-PA',
        jsonb_build_array(
            jsonb_build_object(
                'designator', '08/26',
                'threshold_a', jsonb_build_object('name','08','lat',19.0567,'lon',73.0070,'elev_m',3.0),
                'threshold_b', jsonb_build_object('name','26','lat',19.0567,'lon',73.0430,'elev_m',3.0),
                'length_m', 3700, 'width_m', 60, 'true_bearing', 80.0, 'surface', 'asphalt'
            )
        ),
        true,
        'Pre-operational at time of v1 build. Coordinates approximate; refine when AIP charts publish.'
    )
on conflict (code) do update set
    name        = excluded.name,
    aai_id      = excluded.aai_id,
    arp_lat     = excluded.arp_lat,
    arp_lon     = excluded.arp_lon,
    elevation_m = excluded.elevation_m,
    ols_code    = excluded.ols_code,
    runways     = excluded.runways,
    active      = excluded.active,
    notes       = excluded.notes,
    updated_at  = now();
