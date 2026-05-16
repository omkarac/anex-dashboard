-- Rename 'evaluated' → 'screened' and add 'open' as the new entry status.
-- Pipeline order: open → evaluating → screened → won → dropped

-- 1. Drop defaults so columns have no dependency on the enum type
alter table assets alter column status drop default;

-- 2. Convert enum columns to plain text (must happen before data updates)
alter table assets         alter column status      type text;
alter table status_history alter column from_status type text;
alter table status_history alter column to_status   type text;

-- 3. Migrate data: evaluated → screened
update assets         set status      = 'screened' where status      = 'evaluated';
update status_history set from_status = 'screened' where from_status = 'evaluated';
update status_history set to_status   = 'screened' where to_status   = 'evaluated';

-- 4. Drop old enum and recreate with five values
drop type asset_status_enum;

create type asset_status_enum as enum (
  'open',
  'evaluating',
  'screened',
  'won',
  'dropped'
);

-- 5. Cast columns back and restore default
alter table assets
  alter column status type asset_status_enum using status::asset_status_enum,
  alter column status set default 'open';

alter table status_history
  alter column from_status type asset_status_enum using from_status::asset_status_enum,
  alter column to_status   type asset_status_enum using to_status::asset_status_enum;
