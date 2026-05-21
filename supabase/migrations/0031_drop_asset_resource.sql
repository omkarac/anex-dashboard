-- ============================================================
-- Migration 0031: retire Source/Resource in favour of SPOC Agent
-- ============================================================
-- The Source/Resource field is superseded by spoc_agent. Backfill any
-- resource values into spoc_agent where spoc_agent is empty (never overwrite
-- an existing SPOC), then drop the column.

update assets
set spoc_agent = resource
where resource is not null
  and btrim(resource) <> ''
  and (spoc_agent is null or btrim(spoc_agent) = '');

alter table assets drop column if exists resource;
