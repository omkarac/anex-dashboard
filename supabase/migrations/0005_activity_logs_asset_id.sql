-- Migration 0005: add asset_id to activity_logs for direct asset association
alter table activity_logs add column asset_id uuid references assets(id);
create index on activity_logs (asset_id, created_at desc) where deleted_at is null;
