-- Skygauge — initial database schema
-- Target: PostgreSQL 15+ with PostGIS extension (works on Supabase out of the box)
-- Run order: 0001_extensions → 0002_tables → 0003_indexes → 0004_views

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ============================================================================
-- Airports (MMR config)
-- ============================================================================
-- Static-ish configuration table holding airport metadata: ARP coordinates,
-- elevation, runway thresholds, and the AAI dropdown ID used by the scraper.

create table if not exists airports (
    id              serial primary key,
    code            varchar(8)   not null unique,            -- VABB, JUHU, NMIA
    name            varchar(128) not null,                   -- "Chhatrapati Shivaji Maharaj Intl"
    aai_id          integer      not null unique,            -- AAI dropdown value: 15, 16, 140
    arp_lat         numeric(10, 7) not null,
    arp_lon         numeric(10, 7) not null,
    arp_geom        geography(point, 4326) generated always as (
                        st_setsrid(st_makepoint(arp_lon::float8, arp_lat::float8), 4326)::geography
                    ) stored,
    elevation_m     numeric(6, 2) not null,                  -- aerodrome elevation AMSL
    ols_code        varchar(8)   not null default '4-PA',    -- ICAO Annex 14 code (e.g. 4-PA for precision approach Code 4)
    runways         jsonb        not null default '[]'::jsonb,
                    -- [{ "designator": "09/27",
                    --    "threshold_a": {"name":"09", "lat":..., "lon":..., "elev_m":...},
                    --    "threshold_b": {"name":"27", "lat":..., "lon":..., "elev_m":...},
                    --    "length_m": 3445,
                    --    "true_bearing": 92.1 }]
    active          boolean      not null default true,
    notes           text,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now()
);

comment on table airports is 'MMR airport configuration including ARP, runways, and AAI dropdown ID for scraping.';

-- ============================================================================
-- Issued NOCs (scraped from AAI NOCAS public endpoint)
-- ============================================================================

create table if not exists noc_issued (
    -- Identity
    noc_id              varchar(64)  primary key,            -- AAI's unique NOC ID
    sacfa_id            varchar(64),
    airport_id          integer      not null references airports(id),

    -- Location (lat/lon as authoritative, geom auto-computed)
    lat                 numeric(10, 7) not null,
    lon                 numeric(10, 7) not null,
    geom                geography(point, 4326) generated always as (
                            st_setsrid(st_makepoint(lon::float8, lat::float8), 4326)::geography
                        ) stored,

    -- Elevation data
    site_elevation_m    numeric(8, 3) not null,
    permissible_top_m   numeric(8, 3),                       -- parsed numeric value
    permissible_top_raw text         not null,               -- original string ("100.58 M (Restricted)")
    is_restricted       boolean      not null default false, -- whether the AAI string flagged it as restricted

    -- Classification
    structure_type      char(1)      not null check (structure_type in ('B','M','P')),
                        -- B = Building, M = SACFA Mast, P = Pole/Wire/Fence
    status              varchar(16)  not null default 'ISSUED',
    issue_date          date,                                -- nullable: AAI sometimes omits this
    issue_date_known    boolean      not null default false,

    -- Provenance
    pdf_url             text,                                -- link to the AAI NOC letter PDF
    owner_name          text,
    site_address        text,

    -- Audit
    raw_payload         jsonb,                               -- full AAI response item for debugging
    scraped_at          timestamptz  not null default now(),
    created_at          timestamptz  not null default now(),
    updated_at          timestamptz  not null default now()
);

comment on table noc_issued is 'Issued NOC records scraped from AAI NOCAS public endpoint. Keyed on AAI NOC ID for idempotent upserts.';
comment on column noc_issued.permissible_top_m is 'Parsed numeric value from permissible_top_raw. NULL if parse failed.';
comment on column noc_issued.is_restricted is 'True if the AAI string contained "Restricted" — indicates conditional approval.';
comment on column noc_issued.issue_date_known is 'False when AAI returned an empty date field. ~44% of historical records lack this.';

-- ============================================================================
-- Appeal cases (parsed from Appellate Committee Meeting Minutes PDFs)
-- ============================================================================

create table if not exists appeal_case (
    id                          serial primary key,
    noc_id                      varchar(64),                 -- may or may not link to noc_issued
    meeting_date                date         not null,
    item_no                     integer,                     -- item number within the meeting agenda

    lat                         numeric(10, 7),
    lon                         numeric(10, 7),
    geom                        geography(point, 4326) generated always as (
                                    case when lat is not null and lon is not null then
                                        st_setsrid(st_makepoint(lon::float8, lat::float8), 4326)::geography
                                    else null end
                                ) stored,

    site_elevation_m            numeric(8, 3),
    approved_top_m              numeric(8, 3),
    approved_top_raw            text,                        -- "140", "BUILDING: 76.29", "Not Specified"
    decision_text               text,                        -- narrative summary of decision

    pdf_url                     text         not null,       -- link to the committee minutes PDF
    raw_payload                 jsonb,
    parse_confidence            varchar(16)  not null default 'auto'
                                check (parse_confidence in ('auto','manual','flagged')),
    parsed_at                   timestamptz  not null default now(),
    created_at                  timestamptz  not null default now(),
    updated_at                  timestamptz  not null default now()
);

comment on table appeal_case is 'Records extracted from Appellate Committee Meeting Minutes PDFs. parse_confidence=flagged means human review needed.';

-- ============================================================================
-- Scrape log (observability)
-- ============================================================================

create table if not exists scrape_log (
    id                  uuid primary key default uuid_generate_v4(),
    scraper             varchar(32)  not null,               -- 'nocas' / 'appeals'
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

comment on table scrape_log is 'Per-run observability for ingestion jobs. One row per (scraper, airport, structure_type, date_window) invocation.';

-- ============================================================================
-- DEM cache (optional — site elevation lookups)
-- ============================================================================
-- Cached site elevations for queried points so we don't re-hit external DEM
-- services. Populated lazily by the API layer.

create table if not exists site_elevation_cache (
    lat_rounded     numeric(8, 5) not null,                  -- rounded to 5 decimals (~1m precision)
    lon_rounded     numeric(8, 5) not null,
    elevation_m     numeric(8, 3) not null,
    source          varchar(32)   not null,                  -- 'srtm' / 'bhuvan' / 'open-elevation'
    fetched_at      timestamptz   not null default now(),
    primary key (lat_rounded, lon_rounded)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Spatial indexes — the killer queries hit these
create index if not exists noc_issued_geom_idx       on noc_issued       using gist (geom);
create index if not exists appeal_case_geom_idx      on appeal_case      using gist (geom);
create index if not exists airports_arp_geom_idx     on airports         using gist (arp_geom);

-- Secondary BTREE indexes for filter/sort patterns
create index if not exists noc_issued_airport_idx    on noc_issued       (airport_id);
create index if not exists noc_issued_issue_date_idx on noc_issued       (issue_date desc nulls last);
create index if not exists noc_issued_structure_idx  on noc_issued       (structure_type);
create index if not exists appeal_case_meeting_idx   on appeal_case      (meeting_date desc);
create index if not exists scrape_log_started_idx    on scrape_log       (started_at desc);

-- ============================================================================
-- updated_at triggers
-- ============================================================================

create or replace function set_updated_at()
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
    for each row execute function set_updated_at();

create trigger appeal_case_updated_at
    before update on appeal_case
    for each row execute function set_updated_at();

create trigger airports_updated_at
    before update on airports
    for each row execute function set_updated_at();

-- ============================================================================
-- RPC: nearby_nocs (called from edge function via Supabase RPC)
-- ============================================================================
-- Spatial query helper. Returns issued NOCs within R metres of (lat, lon),
-- sorted by distance ascending, with distance returned as a column.

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
        st_distance(n.geom, st_setsrid(st_makepoint(q_lon, q_lat), 4326)::geography) as distance_m,
        n.lat,
        n.lon,
        n.site_elevation_m,
        n.permissible_top_m,
        n.is_restricted,
        n.structure_type,
        n.issue_date,
        n.pdf_url
    from noc_issued n
    where st_dwithin(n.geom, st_setsrid(st_makepoint(q_lon, q_lat), 4326)::geography, radius_m)
    order by distance_m asc
    limit max_results
$$;

comment on function nearby_nocs is 'Returns issued NOCs within radius_m metres of (lat, lon), sorted by distance. Uses GIST spatial index.';

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
        st_distance(a.geom, st_setsrid(st_makepoint(q_lon, q_lat), 4326)::geography) as distance_m,
        a.meeting_date,
        a.lat,
        a.lon,
        a.site_elevation_m,
        a.approved_top_m,
        a.approved_top_raw,
        a.pdf_url
    from appeal_case a
    where a.geom is not null
      and st_dwithin(a.geom, st_setsrid(st_makepoint(q_lon, q_lat), 4326)::geography, radius_m)
    order by distance_m asc
    limit max_results
$$;

comment on function nearby_appeals is 'Returns appellate committee cases within radius_m metres of (lat, lon).';

-- ============================================================================
-- View: noc_neighborhood_stats
-- ============================================================================
-- Pre-computed summary view that the edge function can query for any point.
-- Not materialized — Postgres can compute this on-demand fast enough at our scale.

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
    median_recent_5y        numeric,                         -- recency-weighted, only last 5 years
    most_recent_issue       date,
    restricted_count        bigint,
    appeal_count_within_1km bigint
)
language sql stable as $$
    with nearby as (
        select n.permissible_top_m, n.is_restricted, n.issue_date
        from noc_issued n
        where st_dwithin(n.geom, st_setsrid(st_makepoint(q_lon, q_lat), 4326)::geography, radius_m)
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
          and st_dwithin(a.geom, st_setsrid(st_makepoint(q_lon, q_lat), 4326)::geography, 1000)
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
-- Done. Next: run seed_airports.sql to populate MMR airports.
-- ============================================================================
