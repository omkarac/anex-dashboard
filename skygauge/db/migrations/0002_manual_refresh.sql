-- Migration 0002 — manual refresh trigger support
-- Adds tracking_id + trigger_source to scrape_log, plus a data-freshness view.
-- Run AFTER 0001_initial_schema.sql.

-- ============================================================================
-- scrape_log: trigger metadata
-- ============================================================================

alter table scrape_log
    add column if not exists tracking_id uuid,
    add column if not exists trigger_source varchar(24) not null default 'cron_daily'
        check (trigger_source in (
            'cron_daily',       -- nightly incremental cron
            'cron_weekly',      -- weekly deeper refresh cron
            'manual_quick',     -- admin button — last 30 days
            'manual_standard',  -- admin button — last 90 days
            'manual_deep',      -- admin button — last 365 days
            'manual_custom',    -- admin button — custom range
            'backfill'          -- initial full historical seed
        ));

create index if not exists scrape_log_tracking_idx on scrape_log (tracking_id);
create index if not exists scrape_log_trigger_idx  on scrape_log (trigger_source, started_at desc);

comment on column scrape_log.tracking_id is
    'Groups all (airport × structure × window) rows from a single trigger event. NULL for pre-migration rows.';
comment on column scrape_log.trigger_source is
    'How the run was started — cron, manual button, or backfill. Lets us filter the admin dashboard.';

-- ============================================================================
-- Data freshness — public-safe summary view
-- ============================================================================
-- The public UI reads from this to display "data updated 2 hours ago".
-- Per-airport so we can flag a single stale source without hiding the whole tool.

create or replace view data_freshness as
select
    a.id                                        as airport_id,
    a.code                                      as airport_code,
    a.name                                      as airport_name,
    coalesce(
        max(s.completed_at) filter (where s.status = 'success'),
        max(n.scraped_at)
    )                                           as last_successful_at,
    (extract(epoch from (now() - coalesce(
        max(s.completed_at) filter (where s.status = 'success'),
        max(n.scraped_at)
    )))) / 3600.0                               as hours_since_refresh,
    count(distinct n.noc_id)                    as total_records,
    count(distinct n.noc_id) filter (
        where n.scraped_at >= now() - interval '7 days'
    )                                           as records_last_7d,
    case
        when coalesce(
            max(s.completed_at) filter (where s.status = 'success'),
            max(n.scraped_at)
        ) is null then 'never'
        when coalesce(
            max(s.completed_at) filter (where s.status = 'success'),
            max(n.scraped_at)
        ) > now() - interval '36 hours' then 'fresh'
        when coalesce(
            max(s.completed_at) filter (where s.status = 'success'),
            max(n.scraped_at)
        ) > now() - interval '7 days'  then 'recent'
        else 'stale'
    end                                         as freshness_state
from airports a
left join scrape_log s on s.airport_id = a.id
left join noc_issued n on n.airport_id = a.id
where a.active = true
group by a.id, a.code, a.name;

comment on view data_freshness is
    'Public-readable summary of when each airport was last refreshed. Used by the UI badge and the admin dashboard.';

-- ============================================================================
-- Helper: most-recent manual run summary
-- ============================================================================
-- Used by the admin panel to show "your last refresh: 3 minutes ago, 47 records added"

create or replace function recent_manual_runs(limit_n integer default 10)
returns table (
    tracking_id      uuid,
    trigger_source   varchar(24),
    airports_covered text,
    started_at       timestamptz,
    completed_at     timestamptz,
    duration_seconds integer,
    total_added      bigint,
    total_errors     bigint,
    overall_status   varchar(16)
)
language sql stable as $$
    select
        s.tracking_id,
        min(s.trigger_source)                           as trigger_source,
        string_agg(distinct a.code, ', ' order by a.code) as airports_covered,
        min(s.started_at)                               as started_at,
        max(s.completed_at)                             as completed_at,
        extract(epoch from (max(s.completed_at) - min(s.started_at)))::int as duration_seconds,
        sum(s.records_added)                            as total_added,
        sum(s.errors)                                   as total_errors,
        case
            when bool_or(s.status = 'running') then 'running'
            when bool_or(s.status = 'failed')  then 'failed'
            when bool_or(s.status = 'partial') then 'partial'
            else 'success'
        end                                             as overall_status
    from scrape_log s
    left join airports a on a.id = s.airport_id
    where s.tracking_id is not null
      and s.trigger_source like 'manual_%'
    group by s.tracking_id
    order by min(s.started_at) desc
    limit limit_n
$$;

comment on function recent_manual_runs is
    'Aggregates scrape_log rows by tracking_id for the admin "recent refreshes" widget.';
