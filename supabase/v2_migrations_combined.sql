-- Migration: 0016_leads_activities.sql
-- Pre-visit leads (tele-calling stage) and activity log

CREATE TABLE leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID        NOT NULL REFERENCES sales_projects(id),
  client_id             UUID        REFERENCES clients(id),
  mobile_primary        TEXT,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  source                lead_source_enum NOT NULL,
  sub_source            TEXT,
  cp_id                 UUID        REFERENCES channel_partners(id),
  campaign_code         TEXT,
  utm_medium            TEXT,
  utm_source            TEXT,
  assigned_presales_id  UUID        REFERENCES team_members(id),
  assigned_at           TIMESTAMPTZ,
  stage                 TEXT        NOT NULL DEFAULT 'new',
  lost_reason           lost_reason_enum,
  next_followup_date    TIMESTAMPTZ,
  is_duplicate          BOOLEAN     DEFAULT false,
  duplicate_of          UUID        REFERENCES leads(id),
  converted_walk_in_id  UUID        REFERENCES walk_ins(id),
  converted_at          TIMESTAMPTZ,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID        NOT NULL REFERENCES team_members(id),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_stage_check CHECK (stage IN ('new','called','interested','site_visit_scheduled','converted','lost')),
  CONSTRAINT lead_mobile_project_unique UNIQUE NULLS NOT DISTINCT (project_id, mobile_primary)
);

CREATE INDEX lead_project_stage     ON leads (project_id, stage)          WHERE is_active = true;
CREATE INDEX lead_presales_followup ON leads (assigned_presales_id, next_followup_date) WHERE is_active = true;
CREATE INDEX lead_cp_idx            ON leads (cp_id)                       WHERE cp_id IS NOT NULL;
CREATE INDEX lead_created           ON leads (project_id, created_at DESC);

-- ── ACTIVITY LOG ──────────────────────────────────────────────
CREATE TABLE lead_activities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID        NOT NULL REFERENCES leads(id),
  walk_in_id          UUID        REFERENCES walk_ins(id),
  sm_id               UUID        NOT NULL REFERENCES team_members(id),
  activity_type       TEXT        NOT NULL,
  call_status         TEXT,
  call_duration_sec   INTEGER,
  outcome             TEXT,
  remarks             TEXT        NOT NULL,
  next_followup_date  TIMESTAMPTZ,
  next_followup_type  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID        NOT NULL REFERENCES team_members(id),
  CONSTRAINT activity_type_check CHECK (activity_type IN ('call','whatsapp','email','note')),
  CONSTRAINT call_status_check   CHECK (call_status IN ('connected','not_answering','busy','wrong_number','not_reachable') OR call_status IS NULL),
  CONSTRAINT outcome_check       CHECK (outcome IN ('interested','not_interested','callback','site_visit_confirmed','lost') OR outcome IS NULL)
);

CREATE INDEX la_lead_date   ON lead_activities (lead_id, created_at DESC);
CREATE INDEX la_followup    ON lead_activities (next_followup_date, sm_id) WHERE next_followup_date IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_admin" ON leads USING (user_is_sales_admin());
CREATE POLICY "leads_sm_select" ON leads FOR SELECT
  USING (project_id = ANY(user_assigned_project_ids()));
CREATE POLICY "leads_sm_insert" ON leads FOR INSERT
  WITH CHECK (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "la_admin"    ON lead_activities USING (user_is_sales_admin());
CREATE POLICY "la_sm_select" ON lead_activities FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE project_id = ANY(user_assigned_project_ids())));
CREATE POLICY "la_sm_insert" ON lead_activities FOR INSERT
  WITH CHECK (lead_id IN (SELECT id FROM leads WHERE project_id = ANY(user_assigned_project_ids())));
-- Migration: 0017_visit_schedules.sql
-- CP Lead Calendar — visit scheduling and attribution

CREATE TABLE visit_schedules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID        NOT NULL REFERENCES sales_projects(id),
  lead_id               UUID        REFERENCES leads(id),
  walk_in_id            UUID        REFERENCES walk_ins(id),
  client_id             UUID        REFERENCES clients(id),
  client_name           TEXT,
  client_mobile         TEXT,
  cp_id                 UUID        REFERENCES channel_partners(id),
  sourcing_sm_id        UUID        NOT NULL REFERENCES team_members(id),
  closing_sm_id         UUID        REFERENCES team_members(id),
  tentative_date        DATE        NOT NULL,
  tentative_time        TIME,
  status                TEXT        NOT NULL DEFAULT 'tentative',
  confirmed_at          TIMESTAMPTZ,
  confirmed_by          UUID        REFERENCES team_members(id),
  rescheduled_from_id   UUID        REFERENCES visit_schedules(id),
  reschedule_reason     TEXT,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  attribution_locked    BOOLEAN     DEFAULT false,
  attribution_locked_at TIMESTAMPTZ,
  reminder_1day_sent    BOOLEAN     DEFAULT false,
  reminder_sameday_sent BOOLEAN     DEFAULT false,
  reminder_1hr_sent     BOOLEAN     DEFAULT false,
  outcome               TEXT,
  outcome_notes         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID        NOT NULL REFERENCES team_members(id),
  CONSTRAINT vs_status_check CHECK (status IN ('tentative','confirmed','reminder_sent','visited','rescheduled','cancelled','no_show'))
);

CREATE INDEX vs_project_date   ON visit_schedules (project_id, tentative_date);
CREATE INDEX vs_status_date    ON visit_schedules (status, tentative_date);
CREATE INDEX vs_sourcing_date  ON visit_schedules (sourcing_sm_id, tentative_date);
CREATE INDEX vs_closing_date   ON visit_schedules (closing_sm_id, tentative_date);
CREATE INDEX vs_cp_idx         ON visit_schedules (cp_id) WHERE cp_id IS NOT NULL;
CREATE INDEX vs_reminders      ON visit_schedules (tentative_date, status)
  WHERE status IN ('confirmed','tentative') AND reminder_1day_sent = false;

ALTER TABLE visit_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vs_admin"    ON visit_schedules USING (user_is_sales_admin());
CREATE POLICY "vs_sm_select" ON visit_schedules FOR SELECT
  USING (project_id = ANY(user_assigned_project_ids()));
CREATE POLICY "vs_sm_insert" ON visit_schedules FOR INSERT
  WITH CHECK (project_id = ANY(user_assigned_project_ids()));
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
