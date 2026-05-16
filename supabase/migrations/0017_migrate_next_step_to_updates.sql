-- Migrate existing next_step values from assets into the updates table.
-- Each asset with a non-empty next_step gets one update entry attributed to
-- whoever last touched the asset, backdated to the asset's updated_at time.
-- The next_step column is left in place (no destructive schema change).

insert into updates (asset_id, body, update_task, update_date, created_by, created_at)
select
  id,
  next_step,
  next_step,
  coalesce(updated_at::date, created_at::date),
  coalesce(updated_by, created_by),
  coalesce(updated_at, created_at)
from assets
where deleted_at is null
  and next_step is not null
  and trim(next_step) != '';
