-- 0036_eod_report_config.sql
-- Capital Markets End-of-Day email report — recipient configuration.
--
-- Two tables:
--   eod_report_config    singleton row; recipient_scope + enabled flag.
--   eod_report_opt_outs  per-member exclusions (only meaningful when scope = 'cm_team').
--
-- The send job (lib/actions/eod-report.sendEodReport) reads both, resolves the
-- recipient list at fire time, and emails via Resend. The single-row constraint
-- on eod_report_config is enforced by a fixed sentinel id so admin writes can
-- always upsert without a race.

CREATE TABLE IF NOT EXISTS eod_report_config (
  id           UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  -- 'admins_only' = admins (role='admin') only.
  -- 'cm_team'     = every active CM member (department in ('cm','both')) minus opt-outs.
  recipient_scope TEXT NOT NULL DEFAULT 'admins_only'
    CHECK (recipient_scope IN ('admins_only', 'cm_team')),
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES team_members(id),
  -- Singleton guard: only the sentinel id is allowed. Any second insert fails.
  CONSTRAINT eod_report_config_singleton CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Seed the singleton row so the admin UI never has to "create" it — only update.
INSERT INTO eod_report_config (id) VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS eod_report_opt_outs (
  member_id   UUID PRIMARY KEY REFERENCES team_members(id) ON DELETE CASCADE,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opted_out_by UUID REFERENCES team_members(id)
);

CREATE INDEX IF NOT EXISTS idx_eod_report_opt_outs_member ON eod_report_opt_outs (member_id);
