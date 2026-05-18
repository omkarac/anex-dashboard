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
