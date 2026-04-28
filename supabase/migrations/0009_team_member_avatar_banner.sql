alter table team_members
  add column if not exists avatar_url text,
  add column if not exists banner_color text;
