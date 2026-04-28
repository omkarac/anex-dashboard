alter table assets add column assigned_to uuid references team_members(id);
create index on assets (assigned_to) where deleted_at is null;
