-- 0023_channel_partners.sql
-- channel_partners + cp_project_records tables

CREATE TABLE channel_partners (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name        TEXT              NOT NULL,
  aliases               TEXT[]            NOT NULL DEFAULT '{}',
  rera_number           TEXT,
  pan_number            TEXT,
  gst_number            TEXT,
  mobile_primary        TEXT,
  mobile_alternate      TEXT,
  email                 TEXT,
  firm_type             cp_firm_type_enum NOT NULL DEFAULT 'individual',
  category              cp_category_enum  NOT NULL DEFAULT 'cp',
  zone                  zone_enum,
  sub_zone              TEXT,
  micromarket           TEXT,
  business_model        TEXT[]            DEFAULT '{}',
  team_size             INTEGER,
  other_developers      TEXT,
  rera_cert_url         TEXT,
  pan_url               TEXT,
  gst_url               TEXT,
  rera_competency_url   TEXT,
  is_rera_verified      BOOLEAN           DEFAULT false,
  is_pan_verified       BOOLEAN           DEFAULT false,
  is_active             BOOLEAN           NOT NULL DEFAULT true,
  is_approved           BOOLEAN           NOT NULL DEFAULT false,
  stage                 cp_stage_enum     NOT NULL DEFAULT 'prospect',
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_by            UUID              NOT NULL REFERENCES team_members(id),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_by            UUID              REFERENCES team_members(id),
  CONSTRAINT cp_canonical_name_unique UNIQUE (canonical_name)
);

CREATE INDEX cp_aliases_gin  ON channel_partners USING GIN (aliases);
CREATE INDEX cp_trgm         ON channel_partners USING GIN (canonical_name gin_trgm_ops);
CREATE INDEX cp_category_idx ON channel_partners (category);
CREATE INDEX cp_active_idx   ON channel_partners (is_active, is_approved);

CREATE TABLE cp_project_records (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  cp_id                 UUID              NOT NULL REFERENCES channel_partners(id),
  project_id            UUID              NOT NULL REFERENCES sales_projects(id),
  owner_sm_id           UUID              REFERENCES team_members(id),
  spoc_name             TEXT,
  spoc_mobile           TEXT,
  spoc_alternate_mobile TEXT,
  spoc_email            TEXT,
  stage                 cp_stage_enum     NOT NULL DEFAULT 'prospect',
  sub_stage             cp_sub_stage_enum,
  next_call_date        TIMESTAMPTZ,
  next_meeting_date     TIMESTAMPTZ,
  last_call_date        DATE,
  last_call_status      TEXT,
  call_count            INTEGER           DEFAULT 0,
  last_meeting_date     DATE,
  meeting_count         INTEGER           DEFAULT 0,
  is_active             BOOLEAN           NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (cp_id, project_id)
);

CREATE INDEX cpr_project_idx ON cp_project_records (project_id, is_active);
CREATE INDEX cpr_sm_idx      ON cp_project_records (owner_sm_id);

-- RLS
ALTER TABLE channel_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_project_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_admin_all" ON channel_partners
  USING (user_is_sales_admin());

CREATE POLICY "cp_sm_select" ON channel_partners
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cp_project_records cpr
      WHERE cpr.cp_id = channel_partners.id
        AND cpr.project_id = ANY(user_assigned_project_ids())
    )
    OR user_is_sales_admin()
  );

CREATE POLICY "cp_sm_insert" ON channel_partners
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM team_members WHERE id = auth.uid() AND role IN ('admin','sales_admin','sales_head','sales_manager'))
  );

CREATE POLICY "cpr_admin_all" ON cp_project_records
  USING (user_is_sales_admin());

CREATE POLICY "cpr_sm_select" ON cp_project_records
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "cpr_sm_insert" ON cp_project_records
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

-- Seed canonical CP names with aliases
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM team_members WHERE role = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN; END IF;

  INSERT INTO channel_partners (canonical_name, aliases, created_by) VALUES
    ('NoBroker',             ARRAY['No Broker','nobroker','No broker','NoBroker.com'],               v_admin_id),
    ('Mayur Traders LLP',    ARRAY['Mayur traders LLP','mayur traders','Mayur Traders'],              v_admin_id),
    ('Riya Estate Consultant',ARRAY['Riya estate Consultant','Riya Estate Consultant ','Riya estate','Riya Estate'], v_admin_id),
    ('PropTiger',            ARRAY['Prop Tiger','proptiger','Prop tiger','PropTiger.com'],             v_admin_id),
    ('KK Thakkar',           ARRAY['KK Thakker','KK Athakkar','kk thakkar'],                         v_admin_id),
    ('DJ Realtors',          ARRAY['D.J Realtors','D J Realtors','DJ realtors'],                     v_admin_id),
    ('Square Yards',         ARRAY['Squareyards','Square yards','squareyards'],                       v_admin_id),
    ('Buri Kali Mata Realty',ARRAY['Bhuri Kali Mata','Buri kali mata','Buri Kali Mata'],              v_admin_id),
    ('Jishnu Realtors',      ARRAY['Jishnuu Realtorss','jishnu realtors'],                           v_admin_id),
    ('Amit Pandya',          ARRAY['Amit Pandiya','amit pandya'],                                    v_admin_id),
    ('260 Launches',         ARRAY['260 launches','260launches'],                                    v_admin_id),
    ('Agent Rathod',         ARRAY['Agent Rathore','agent rathod'],                                  v_admin_id),
    ('Mumbai Aaxis',         ARRAY['Mumbai Axis','mumbai aaxis'],                                    v_admin_id),
    ('Navigators',           ARRAY['Navigators Reality','Navigators Realty','navigators'],           v_admin_id),
    ('Siddhivinayak Realty', ARRAY['Siddhivinayak Estate','siddhivinayak realty'],                   v_admin_id),
    ('Happy Realty',         ARRAY['Happy Realty & Financial Consultnacy','happy realty'],           v_admin_id),
    ('Jai Maa Sharda',       ARRAY['jai maa sharda'],                                               v_admin_id),
    ('Abode India',          ARRAY['Abroad India','abode india'],                                    v_admin_id)
  ON CONFLICT (canonical_name) DO NOTHING;
END $$;
