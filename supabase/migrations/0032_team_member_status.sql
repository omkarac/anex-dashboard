-- 0032_team_member_status.sql
-- Member lifecycle status — powers the quarantine / waiting-room gate.
--
--   'pending'     newly joined; awaiting an admin to assign role + department.
--                 No app access until released — sees the holding page only.
--   'active'      onboarded; full access (subject to role/department).
--   'deactivated' offboarded (paired with is_active = false; used by handover).
--
-- Additive + idempotent per repo migration rules. `is_active` is retained as the
-- offboarding flag; `status` adds the onboarding dimension on top of it.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('pending', 'active', 'deactivated'));

-- Backfill: existing members keep working (default 'active'); already-offboarded
-- members are marked deactivated so the two flags stay consistent.
UPDATE team_members SET status = 'deactivated' WHERE is_active = false AND status <> 'deactivated';

CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members (status);
