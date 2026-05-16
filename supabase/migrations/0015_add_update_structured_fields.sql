-- Add structured fields to updates for rule-based deal logging.
-- update_date: the date the event occurred (distinct from created_at when it was logged).
-- update_task: what happened or needs to happen.
-- comment: additional context (optional).
-- body is kept non-null for backward compat; new rows populate it from the structured fields.

alter table updates
  add column update_date date,
  add column update_task text,
  add column comment     text;
