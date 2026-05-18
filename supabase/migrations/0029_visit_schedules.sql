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
