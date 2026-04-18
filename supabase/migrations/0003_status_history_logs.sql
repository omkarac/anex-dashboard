-- ============================================================
-- Migration 0003: status_history, activity_logs, updates, tasks
-- ============================================================

create table status_history (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references assets(id),
  from_status      asset_status_enum,
  to_status        asset_status_enum not null,
  from_temperature asset_temperature_enum,
  to_temperature   asset_temperature_enum,
  note             text,
  changed_by       uuid not null references team_members(id),
  changed_at       timestamptz not null default now()
);

create index on status_history (asset_id, changed_at desc);

create table activity_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references team_members(id),
  action        text not null,
  entity_type   text not null,
  entity_id     uuid not null,
  summary       text not null,
  diff          jsonb,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references team_members(id),
  delete_reason text
);

create index on activity_logs (entity_type, entity_id, created_at desc);
create index on activity_logs (actor_id, created_at desc);
create index on activity_logs (created_at desc) where deleted_at is null;

create table updates (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references assets(id),
  body       text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references team_members(id),
  deleted_at timestamptz,
  deleted_by uuid references team_members(id)
);

create index on updates (asset_id, created_at desc) where deleted_at is null;

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references assets(id),
  title        text not null,
  description  text,
  status       task_status_enum not null default 'todo',
  priority     task_priority_enum not null default 'medium',
  assigned_to  uuid references team_members(id),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid not null references team_members(id),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  deleted_by   uuid references team_members(id)
);

create index on tasks (asset_id) where deleted_at is null;
create index on tasks (assigned_to) where deleted_at is null;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- RLS
alter table status_history enable row level security;
create policy "status_history_read" on status_history
  for select using (auth.uid() is not null);
create policy "status_history_insert" on status_history
  for insert with check (auth.uid() is not null);

alter table activity_logs enable row level security;
create policy "activity_logs_read" on activity_logs
  for select using (auth.uid() is not null and deleted_at is null);
create policy "activity_logs_insert" on activity_logs
  for insert with check (auth.uid() is not null);
create policy "activity_logs_soft_delete" on activity_logs
  for update using (auth.uid() is not null);

alter table updates enable row level security;
create policy "updates_read" on updates
  for select using (auth.uid() is not null and deleted_at is null);
create policy "updates_write" on updates
  for all using (auth.uid() is not null);

alter table tasks enable row level security;
create policy "tasks_read" on tasks
  for select using (auth.uid() is not null and deleted_at is null);
create policy "tasks_write" on tasks
  for all using (auth.uid() is not null);
