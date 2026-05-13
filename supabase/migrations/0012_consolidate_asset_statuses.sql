-- ============================================================
-- Migration 0012: Consolidate asset statuses to 4 values
--   new, initial_assessment, on_hold  → evaluating
--   shared_with_developer             → evaluated
--   evaluating, evaluated, won, dropped → unchanged
-- ============================================================

-- 1. Migrate existing data in assets
update assets set status = 'evaluating'
  where status in ('new', 'initial_assessment', 'on_hold');

update assets set status = 'evaluated'
  where status = 'shared_with_developer';

-- 2. Migrate existing data in status_history
update status_history set from_status = 'evaluating'
  where from_status in ('new', 'initial_assessment', 'on_hold');

update status_history set from_status = 'evaluated'
  where from_status = 'shared_with_developer';

update status_history set to_status = 'evaluating'
  where to_status in ('new', 'initial_assessment', 'on_hold');

update status_history set to_status = 'evaluated'
  where to_status = 'shared_with_developer';

-- 3. Drop column default (it holds a cast to the old enum type)
alter table assets alter column status drop default;

-- 4. Convert columns to text so we can drop and recreate the enum
alter table assets
  alter column status type text;

alter table status_history
  alter column from_status type text,
  alter column to_status   type text;

-- 5. Drop old enum and create the new slim one
drop type asset_status_enum;

create type asset_status_enum as enum ('evaluating', 'evaluated', 'won', 'dropped');

-- 5. Cast columns back to new enum type
alter table assets
  alter column status type asset_status_enum using status::asset_status_enum,
  alter column status set default 'evaluating';

alter table status_history
  alter column from_status type asset_status_enum using from_status::asset_status_enum,
  alter column to_status   type asset_status_enum using to_status::asset_status_enum;
