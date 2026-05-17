-- Migration 0027: add department classification to team_members
-- Values: 'cm' (Capital Markets), 'sm' (Sales & Marketing), 'both', or NULL (unassigned)

ALTER TABLE team_members
  ADD COLUMN department TEXT
    CHECK (department IN ('cm', 'sm', 'both'))
    DEFAULT NULL;