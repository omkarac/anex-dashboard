-- 0035_asset_name_trigram_index.sql
-- Speed up live asset-registry search. The ILIKE '%q%' the search input fires
-- on every keystroke runs a sequential scan without an index — fine for the
-- first hundred rows, painful as the registry grows. A GIN trigram index
-- makes substring matching index-assisted so the DB-side query stays under
-- ~15ms at any realistic scale.
--
-- Partial WHERE deleted_at IS NULL keeps the index small since soft-deleted
-- rows are never returned anyway.

create extension if not exists pg_trgm;

create index if not exists assets_property_name_trgm_idx
    on assets using gin (property_name gin_trgm_ops)
    where deleted_at is null;
