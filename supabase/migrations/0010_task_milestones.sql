-- Fix: tasks.updated_by was referenced in code but column didn't exist
alter table tasks add column if not exists updated_by uuid references team_members(id);

-- Milestone flag for the two fixed tasks every asset must have
alter table tasks add column if not exists is_milestone boolean not null default false;

-- Seed the two milestone tasks for all existing (non-deleted) assets
do $$
declare
  actor_id uuid;
begin
  select id into actor_id from team_members where is_active = true order by created_at limit 1;
  if actor_id is not null then
    insert into tasks (asset_id, title, is_milestone, created_by, status, priority)
    select
      a.id,
      mt.title,
      true,
      actor_id,
      'todo',
      'high'
    from assets a
    cross join (values ('Feasibility'), ('Information Memorandum (IM)')) as mt(title)
    where a.deleted_at is null
      and not exists (
        select 1 from tasks t
        where t.asset_id = a.id
          and t.title = mt.title
          and t.is_milestone = true
          and t.deleted_at is null
      );
  end if;
end $$;
