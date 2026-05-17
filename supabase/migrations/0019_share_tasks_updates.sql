-- Routine tasks and interaction log for each developer share.
-- share_tasks: IM / FF / EOI tasks created automatically on share, plus custom ones.
-- share_updates: append-only update chain; completed tasks are auto-inserted here.

create table share_tasks (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null references developer_shares(id) on delete cascade,
  title        text not null,
  task_type    text,            -- 'im_shared' | 'ff_shared' | 'eoi_issued' | 'custom'
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

create index on share_tasks (share_id) where deleted_at is null;
create index on share_tasks (assigned_to) where deleted_at is null;

create table share_updates (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null references developer_shares(id) on delete cascade,
  body         text not null,
  source       text not null default 'manual',  -- 'manual' | 'task_completed'
  task_id      uuid references share_tasks(id),
  created_at   timestamptz not null default now(),
  created_by   uuid not null references team_members(id),
  deleted_at   timestamptz,
  deleted_by   uuid references team_members(id)
);

create index on share_updates (share_id, created_at desc) where deleted_at is null;
