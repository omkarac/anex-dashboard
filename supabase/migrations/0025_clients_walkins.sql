-- 0025_clients_walkins.sql
-- clients + walk_ins + site_visits tables

CREATE TABLE clients (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_primary        TEXT              NOT NULL,
  mobile_alternate      TEXT,
  salutation            TEXT,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  alternate_email       TEXT,
  age_bracket           age_bracket_enum,
  gender                TEXT,
  occupation            TEXT,
  employment_type       employment_enum,
  designation           TEXT,
  marital_status        TEXT,
  family_size           INTEGER,
  household_income      TEXT,
  highest_education     TEXT,
  ethnicity             TEXT,
  residential_address   JSONB,
  office_address        JSONB,
  company_name          TEXT,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  CONSTRAINT client_mobile_unique UNIQUE (mobile_primary),
  CONSTRAINT mobile_10_digits     CHECK (mobile_primary ~ '^\d{10}$')
);

CREATE INDEX client_mobile_idx ON clients (mobile_primary);

CREATE TABLE walk_ins (
  id                          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID              NOT NULL REFERENCES sales_projects(id),
  client_id                   UUID              NOT NULL REFERENCES clients(id),
  source                      lead_source_enum  NOT NULL,
  sub_source                  TEXT,
  cp_id                       UUID              REFERENCES channel_partners(id),
  referrer_name               TEXT,
  sourcing_sm_id              UUID              REFERENCES team_members(id),
  closing_sm_id               UUID              REFERENCES team_members(id),
  configuration               config_enum,
  budget                      TEXT,
  carpet_area                 NUMERIC(10,2),
  construction_status_pref    TEXT,
  purpose                     purpose_enum,
  possession_timeframe        TEXT,
  current_residence_status    TEXT,
  status                      lead_status_enum  NOT NULL DEFAULT 'cold',
  latest_remark               TEXT,
  latest_remark_date          DATE,
  lost_reason                 lost_reason_enum,
  tele_caller_remark          TEXT,
  is_active                   BOOLEAN           NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_by                  UUID              NOT NULL REFERENCES team_members(id),
  updated_at                  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_by                  UUID              REFERENCES team_members(id),
  CONSTRAINT one_active_per_client_project UNIQUE NULLS NOT DISTINCT (client_id, project_id)
);

CREATE INDEX wi_project_status    ON walk_ins (project_id, status)        WHERE is_active = true;
CREATE INDEX wi_project_source    ON walk_ins (project_id, source)        WHERE is_active = true;
CREATE INDEX wi_project_config    ON walk_ins (project_id, configuration) WHERE is_active = true;
CREATE INDEX wi_cp_idx            ON walk_ins (cp_id)                     WHERE is_active = true;
CREATE INDEX wi_closing_sm_idx    ON walk_ins (closing_sm_id)             WHERE is_active = true;
CREATE INDEX wi_sourcing_sm_idx   ON walk_ins (sourcing_sm_id)            WHERE is_active = true;
CREATE INDEX wi_project_date      ON walk_ins (project_id, created_at DESC);
CREATE INDEX wi_lost_reason_idx   ON walk_ins (project_id, lost_reason)   WHERE status = 'lost';

CREATE TABLE site_visits (
  id                            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  walk_in_id                    UUID              NOT NULL REFERENCES walk_ins(id),
  client_id                     UUID              NOT NULL REFERENCES clients(id),
  project_id                    UUID              NOT NULL REFERENCES sales_projects(id),
  visit_number                  INTEGER           NOT NULL DEFAULT 1,
  visit_date                    DATE              NOT NULL DEFAULT CURRENT_DATE,
  visit_type                    visit_type_enum   NOT NULL DEFAULT 'site_visit',
  accompanied_by                TEXT,
  assigned_sm_id                UUID              REFERENCES team_members(id),
  checklist_show_flat           BOOLEAN           DEFAULT false,
  checklist_sample_flat         BOOLEAN           DEFAULT false,
  checklist_av_video            BOOLEAN           DEFAULT false,
  checklist_unit_plan           BOOLEAN           DEFAULT false,
  checklist_pricing_discussion  BOOLEAN           DEFAULT false,
  checklist_site_tour           BOOLEAN           DEFAULT false,
  opportunity_stage             TEXT,
  opportunity_sub_stage         TEXT,
  sub_stage_reason              TEXT,
  next_followup_date            TIMESTAMPTZ,
  proposed_revisit_date         TIMESTAMPTZ,
  comments                      TEXT,
  gre_remarks                   TEXT,
  created_at                    TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_by                    UUID              NOT NULL REFERENCES team_members(id)
);

CREATE INDEX sv_walk_in_idx    ON site_visits (walk_in_id);
CREATE INDEX sv_project_date   ON site_visits (project_id, visit_date DESC);
CREATE INDEX sv_sm_idx         ON site_visits (assigned_sm_id);
CREATE INDEX sv_project_number ON site_visits (project_id, visit_number);

-- Trigger: enforce booked status immutability (BR-006)
CREATE OR REPLACE FUNCTION enforce_booked_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'booked' AND NEW.status != 'booked' THEN
    IF NOT EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid() AND role IN ('admin', 'sales_admin')
    ) THEN
      RAISE EXCEPTION 'Cannot change status away from booked. Only admin or sales_admin can un-book.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_enforce_booked_immutable
  BEFORE UPDATE ON walk_ins
  FOR EACH ROW EXECUTE FUNCTION enforce_booked_immutable();

-- Trigger: set updated_at on walk_ins and clients
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_walk_ins_updated_at
  BEFORE UPDATE ON walk_ins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- Clients: any authenticated sales role can see/insert
CREATE POLICY "clients_sales_select" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid() AND role IN ('admin','sales_admin','sales_head','sales_manager')
    )
  );

CREATE POLICY "clients_sales_insert" ON clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid() AND role IN ('admin','sales_admin','sales_head','sales_manager')
    )
  );

CREATE POLICY "clients_sales_update" ON clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid() AND role IN ('admin','sales_admin','sales_head')
    )
  );

-- Walk-ins
CREATE POLICY "wi_admin_all" ON walk_ins
  USING (user_is_sales_admin());

CREATE POLICY "wi_sm_select" ON walk_ins
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "wi_sm_insert" ON walk_ins
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "wi_sm_update" ON walk_ins
  FOR UPDATE USING (project_id = ANY(user_assigned_project_ids()))
  WITH CHECK (project_id = ANY(user_assigned_project_ids()));

-- Site visits
CREATE POLICY "sv_admin_all" ON site_visits
  USING (user_is_sales_admin());

CREATE POLICY "sv_sm_select" ON site_visits
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "sv_sm_insert" ON site_visits
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));
