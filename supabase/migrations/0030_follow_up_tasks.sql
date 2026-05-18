-- Migration: 0018_follow_up_tasks.sql
-- Follow-up discipline engine + push notification subscriptions

CREATE TABLE follow_up_tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        REFERENCES leads(id),
  walk_in_id        UUID        REFERENCES walk_ins(id),
  assigned_to       UUID        NOT NULL REFERENCES team_members(id),
  due_at            TIMESTAMPTZ NOT NULL,
  task_type         TEXT        NOT NULL DEFAULT 'follow_up_call',
  notes             TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending',
  completed_at      TIMESTAMPTZ,
  completed_by      UUID        REFERENCES team_members(id),
  snoozed_until     TIMESTAMPTZ,
  snooze_count      INTEGER     DEFAULT 0,
  escalated_at      TIMESTAMPTZ,
  escalated_to      UUID        REFERENCES team_members(id),
  escalation_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID        NOT NULL REFERENCES team_members(id),
  CONSTRAINT ft_has_entity CHECK (lead_id IS NOT NULL OR walk_in_id IS NOT NULL),
  CONSTRAINT ft_task_type_check CHECK (task_type IN (
    'follow_up_call','revisit_reminder','pre_visit_confirmation',
    'post_visit_update','custom'
  )),
  CONSTRAINT ft_status_check CHECK (status IN ('pending','completed','missed','snoozed','cancelled'))
);

CREATE INDEX ft_assigned_due ON follow_up_tasks (assigned_to, due_at)
  WHERE status = 'pending';
CREATE INDEX ft_missed_idx ON follow_up_tasks (assigned_to)
  WHERE status = 'missed';
CREATE INDEX ft_lead_idx    ON follow_up_tasks (lead_id)    WHERE lead_id IS NOT NULL;
CREATE INDEX ft_walkin_idx  ON follow_up_tasks (walk_in_id) WHERE walk_in_id IS NOT NULL;
CREATE INDEX ft_escalated   ON follow_up_tasks (escalated_to) WHERE escalated_at IS NOT NULL;

-- Trigger: auto-mark tasks as missed after 3 hours
-- (Run via Supabase pg_cron every 30 minutes — add to Edge Function)
CREATE OR REPLACE FUNCTION mark_overdue_tasks()
RETURNS void AS $$
  UPDATE follow_up_tasks
  SET status = 'missed'
  WHERE status = 'pending'
    AND due_at < NOW() - INTERVAL '3 hours';
$$ LANGUAGE sql;

-- ── PUSH SUBSCRIPTIONS ────────────────────────────────────────
CREATE TABLE push_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES team_members(id),
  endpoint      TEXT        NOT NULL,
  p256dh        TEXT        NOT NULL,
  auth          TEXT        NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (user_id, endpoint)
);

CREATE INDEX ps_user_active ON push_subscriptions (user_id) WHERE is_active = true;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE follow_up_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ft_admin"      ON follow_up_tasks USING (user_is_sales_admin());
CREATE POLICY "ft_own_select" ON follow_up_tasks FOR SELECT
  USING (assigned_to = auth.uid() OR escalated_to = auth.uid());
CREATE POLICY "ft_own_insert" ON follow_up_tasks FOR INSERT
  WITH CHECK (true);  -- any authenticated user can create tasks
CREATE POLICY "ft_own_update" ON follow_up_tasks FOR UPDATE
  USING (assigned_to = auth.uid() OR user_is_sales_admin());

CREATE POLICY "ps_own" ON push_subscriptions
  USING (user_id = auth.uid());
