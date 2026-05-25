-- 0034_skygauge_appeals_unique.sql
-- Skygauge Slice 12 — make appeal_case imports idempotent.
--
-- appeal_case (from 0033) has only a serial PK, so a re-run of the appeals seed
-- would duplicate rows. Add a unique index over the natural key
-- (noc_id, meeting_date, item_no) so the importer can upsert on conflict.
--
-- Postgres treats NULLs as distinct in unique indexes, so rows lacking a
-- noc_id/item_no simply won't dedupe — acceptable for the historical seed,
-- whose rows all carry the natural key.

create unique index if not exists appeal_case_natural_key_idx
    on appeal_case (noc_id, meeting_date, item_no);
