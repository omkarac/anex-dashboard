-- File attachments per asset (SharePoint links + custom titles, drag-sortable)

create table asset_files (
  id            uuid        primary key default gen_random_uuid(),
  asset_id      uuid        not null references assets(id) on delete cascade,
  url           text        not null,
  title         text        not null default '',
  sort_order    integer     not null default 0,
  created_by    uuid        references auth.users(id),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid        references auth.users(id)
);

create index on asset_files (asset_id) where deleted_at is null;

alter table asset_files enable row level security;

create policy "Authenticated users can manage asset files"
  on asset_files for all
  to authenticated
  using (true)
  with check (true);
