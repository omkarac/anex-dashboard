-- sales_migrations_combined.sql
-- Idempotent: safe to re-run if any earlier partial run succeeded.
-- Paste into Supabase SQL editor and run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0021: enums, role extensions, RLS helpers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'sales_head';
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'sales_admin';

DO $$ BEGIN CREATE TYPE lead_status_enum    AS ENUM ('hot','warm','cold','lost','booked');                 EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_source_enum    AS ENUM ('cp','direct');                                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE meeting_type_enum   AS ENUM ('obm','ibm');                                         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE meeting_cat_enum    AS ENUM ('unique','repeat');                                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE config_enum         AS ENUM ('1bhk','2bhk','3bhk','2bhk_jodi','duplex','2_3bhk','commercial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cp_category_enum    AS ENUM ('icp','rcp','cp');                                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cp_stage_enum       AS ENUM ('prospect','active','inactive');                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cp_sub_stage_enum   AS ENUM ('high_potential','low_potential','walkin_active','sourcing_active','inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lost_reason_enum    AS ENUM (
  'not_responding','budget','booked_elsewhere','plan_dropped','didnt_like_project',
  'layout_issue','requirement_mismatch','not_interested','general_enquiry',
  'location_issue','floor_issue','possession_timeline','vaastu_issue','view_issue','other'
);                                                                                                         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE age_bracket_enum    AS ENUM ('below_25','25_30','31_40','41_50','51_60','above_60'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE purpose_enum        AS ENUM ('self_use','investment','both');                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE employment_enum     AS ENUM ('salaried','self_employed','business_owner','retired','student','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE visit_type_enum     AS ENUM ('site_visit','home_visit','video_call','office_visit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cp_firm_type_enum   AS ENUM ('individual','private_limited','public_limited','partnership','llp','proprietorship'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zone_enum           AS ENUM ('kdmc','thane','central','navi_mumbai','south_mumbai','western_suburbs','eastern_suburbs','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION user_assigned_project_ids()
RETURNS UUID[] AS $$
DECLARE
  result UUID[];
BEGIN
  SELECT ARRAY_AGG(project_id) INTO result
  FROM project_sm_assignments
  WHERE sm_id = auth.uid() AND is_active = true;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_is_sales_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE id = auth.uid() AND role::text IN ('admin', 'sales_admin', 'sales_head')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0022: sales_projects + project_sm_assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_projects (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID          REFERENCES assets(id),
  name              TEXT          NOT NULL,
  location          TEXT,
  developer_name    TEXT,
  launch_date       DATE,
  available_configs config_enum[] DEFAULT '{}',
  price_min         NUMERIC(14,2),
  price_max         NUMERIC(14,2),
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by        UUID          NOT NULL REFERENCES team_members(id)
);

-- Back-fill any columns missing from an earlier partial run
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS asset_id        UUID          REFERENCES assets(id);
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS location        TEXT;
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS developer_name  TEXT;
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS launch_date     DATE;
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS available_configs config_enum[] DEFAULT '{}';
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS price_min       NUMERIC(14,2);
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS price_max       NUMERIC(14,2);
ALTER TABLE sales_projects ADD COLUMN IF NOT EXISTS is_active       BOOLEAN       DEFAULT true;

CREATE TABLE IF NOT EXISTS project_sm_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES sales_projects(id),
  sm_id         UUID        NOT NULL REFERENCES team_members(id),
  sm_role       TEXT        NOT NULL DEFAULT 'both',
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by   UUID        REFERENCES team_members(id),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (project_id, sm_id)
);

ALTER TABLE sales_projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sm_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_projects_admin_all" ON sales_projects;
DROP POLICY IF EXISTS "sales_projects_sm_select" ON sales_projects;
DROP POLICY IF EXISTS "psa_admin_all"             ON project_sm_assignments;
DROP POLICY IF EXISTS "psa_sm_select"             ON project_sm_assignments;

CREATE POLICY "sales_projects_admin_all" ON sales_projects
  USING (user_is_sales_admin());

CREATE POLICY "sales_projects_sm_select" ON sales_projects
  FOR SELECT USING (id = ANY(user_assigned_project_ids()));

CREATE POLICY "psa_admin_all" ON project_sm_assignments
  USING (user_is_sales_admin());

CREATE POLICY "psa_sm_select" ON project_sm_assignments
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM team_members WHERE role::text = 'admin' LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO sales_projects (name, location, developer_name, available_configs, price_min, price_max, created_by)
    VALUES (
      '7 Folds (Minal & Madhav Kunj)',
      'Vile Parle East',
      '7 Folds Developers',
      ARRAY['1bhk','2bhk','3bhk','2bhk_jodi','duplex']::config_enum[],
      18000000, 55000000,
      v_admin_id
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO sales_projects (name, location, developer_name, available_configs, created_by)
    VALUES (
      'Sher E Punjab',
      'Andheri East',
      'Sher E Punjab Developers',
      ARRAY['1bhk','2bhk','3bhk','2bhk_jodi']::config_enum[],
      v_admin_id
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0023: channel_partners + cp_project_records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channel_partners (
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

-- Back-fill any columns missing from an earlier partial run
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS aliases               TEXT[]            DEFAULT '{}';
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS rera_number           TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS pan_number            TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS gst_number            TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS mobile_primary        TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS mobile_alternate      TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS email                 TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS firm_type             cp_firm_type_enum DEFAULT 'individual';
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS category              cp_category_enum  DEFAULT 'cp';
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS zone                  zone_enum;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS sub_zone              TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS micromarket           TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS business_model        TEXT[]            DEFAULT '{}';
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS team_size             INTEGER;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS other_developers      TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS rera_cert_url         TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS pan_url               TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS gst_url               TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS rera_competency_url   TEXT;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS is_rera_verified      BOOLEAN           DEFAULT false;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS is_pan_verified       BOOLEAN           DEFAULT false;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS is_approved           BOOLEAN           DEFAULT false;
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS stage                 cp_stage_enum     DEFAULT 'prospect';
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ       DEFAULT now();
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS updated_by            UUID              REFERENCES team_members(id);

-- Add unique constraint if missing (needed for ON CONFLICT (canonical_name))
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cp_canonical_name_unique') THEN
    ALTER TABLE channel_partners ADD CONSTRAINT cp_canonical_name_unique UNIQUE (canonical_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cp_aliases_gin  ON channel_partners USING GIN (aliases);
CREATE INDEX IF NOT EXISTS cp_trgm         ON channel_partners USING GIN (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cp_category_idx ON channel_partners (category);
CREATE INDEX IF NOT EXISTS cp_active_idx   ON channel_partners (is_active, is_approved);

CREATE TABLE IF NOT EXISTS cp_project_records (
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

-- Back-fill cp_project_records columns (all columns)
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS cp_id                 UUID              REFERENCES channel_partners(id);
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS project_id            UUID              REFERENCES sales_projects(id);
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS owner_sm_id           UUID              REFERENCES team_members(id);
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS spoc_name             TEXT;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS spoc_mobile           TEXT;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS spoc_alternate_mobile TEXT;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS spoc_email            TEXT;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS stage                 cp_stage_enum     DEFAULT 'prospect';
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS sub_stage             cp_sub_stage_enum;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS next_call_date        TIMESTAMPTZ;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS next_meeting_date     TIMESTAMPTZ;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS last_call_date        DATE;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS last_call_status      TEXT;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS call_count            INTEGER           DEFAULT 0;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS last_meeting_date     DATE;
ALTER TABLE cp_project_records ADD COLUMN IF NOT EXISTS meeting_count         INTEGER           DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpr_cp_project_unique') THEN
    ALTER TABLE cp_project_records ADD CONSTRAINT cpr_cp_project_unique UNIQUE (cp_id, project_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cpr_project_idx ON cp_project_records (project_id, is_active);
CREATE INDEX IF NOT EXISTS cpr_sm_idx      ON cp_project_records (owner_sm_id);

ALTER TABLE channel_partners    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_project_records  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_admin_all"  ON channel_partners;
DROP POLICY IF EXISTS "cp_sm_select"  ON channel_partners;
DROP POLICY IF EXISTS "cp_sm_insert"  ON channel_partners;
DROP POLICY IF EXISTS "cpr_admin_all" ON cp_project_records;
DROP POLICY IF EXISTS "cpr_sm_select" ON cp_project_records;
DROP POLICY IF EXISTS "cpr_sm_insert" ON cp_project_records;

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
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid()
        AND role::text IN ('admin','sales_admin','sales_head','sales_manager')
    )
  );

CREATE POLICY "cpr_admin_all" ON cp_project_records
  USING (user_is_sales_admin());

CREATE POLICY "cpr_sm_select" ON cp_project_records
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "cpr_sm_insert" ON cp_project_records
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM team_members WHERE role::text = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN; END IF;

  INSERT INTO channel_partners (canonical_name, aliases, created_by) VALUES
    ('NoBroker',              ARRAY['No Broker','nobroker','No broker','NoBroker.com'],                v_admin_id),
    ('Mayur Traders LLP',     ARRAY['Mayur traders LLP','mayur traders','Mayur Traders'],              v_admin_id),
    ('Riya Estate Consultant',ARRAY['Riya estate Consultant','Riya Estate Consultant ','Riya estate','Riya Estate'], v_admin_id),
    ('PropTiger',             ARRAY['Prop Tiger','proptiger','Prop tiger','PropTiger.com'],             v_admin_id),
    ('KK Thakkar',            ARRAY['KK Thakker','KK Athakkar','kk thakkar'],                         v_admin_id),
    ('DJ Realtors',           ARRAY['D.J Realtors','D J Realtors','DJ realtors'],                     v_admin_id),
    ('Square Yards',          ARRAY['Squareyards','Square yards','squareyards'],                       v_admin_id),
    ('Buri Kali Mata Realty', ARRAY['Bhuri Kali Mata','Buri kali mata','Buri Kali Mata'],              v_admin_id),
    ('Jishnu Realtors',       ARRAY['Jishnuu Realtorss','jishnu realtors'],                           v_admin_id),
    ('Amit Pandya',           ARRAY['Amit Pandiya','amit pandya'],                                    v_admin_id),
    ('260 Launches',          ARRAY['260 launches','260launches'],                                    v_admin_id),
    ('Agent Rathod',          ARRAY['Agent Rathore','agent rathod'],                                  v_admin_id),
    ('Mumbai Aaxis',          ARRAY['Mumbai Axis','mumbai aaxis'],                                    v_admin_id),
    ('Navigators',            ARRAY['Navigators Reality','Navigators Realty','navigators'],            v_admin_id),
    ('Siddhivinayak Realty',  ARRAY['Siddhivinayak Estate','siddhivinayak realty'],                   v_admin_id),
    ('Happy Realty',          ARRAY['Happy Realty & Financial Consultnacy','happy realty'],            v_admin_id),
    ('Jai Maa Sharda',        ARRAY['jai maa sharda'],                                                v_admin_id),
    ('Abode India',           ARRAY['Abroad India','abode india'],                                    v_admin_id)
  ON CONFLICT (canonical_name) DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0024: cp_meetings + eod_reports
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cp_meetings (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID              NOT NULL REFERENCES sales_projects(id),
  cp_id                 UUID              NOT NULL REFERENCES channel_partners(id),
  sm_id                 UUID              NOT NULL REFERENCES team_members(id),
  meeting_date          DATE              NOT NULL DEFAULT CURRENT_DATE,
  meeting_type          meeting_type_enum NOT NULL,
  meeting_category      meeting_cat_enum  NOT NULL,
  place_from            TEXT,
  place_to              TEXT,
  travel_mode           TEXT,
  km_travelled          NUMERIC(8,1),
  is_interested         BOOLEAN,
  nri_lead              BOOLEAN           DEFAULT false,
  rating                SMALLINT          CHECK (rating BETWEEN 1 AND 5),
  feedback              TEXT,
  cp_stage_updated_to   cp_stage_enum,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_by            UUID              NOT NULL REFERENCES team_members(id)
);

-- Back-fill cp_meetings columns (all columns)
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS project_id          UUID              REFERENCES sales_projects(id);
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS cp_id               UUID              REFERENCES channel_partners(id);
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS sm_id               UUID              REFERENCES team_members(id);
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS meeting_date        DATE              DEFAULT CURRENT_DATE;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS meeting_type        meeting_type_enum;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS meeting_category    meeting_cat_enum;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS created_by          UUID              REFERENCES team_members(id);
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS place_from          TEXT;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS place_to            TEXT;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS travel_mode         TEXT;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS km_travelled        NUMERIC(8,1);
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS is_interested       BOOLEAN;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS nri_lead            BOOLEAN       DEFAULT false;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS rating              SMALLINT;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS feedback            TEXT;
ALTER TABLE cp_meetings ADD COLUMN IF NOT EXISTS cp_stage_updated_to cp_stage_enum;

CREATE INDEX IF NOT EXISTS cm_month_lookup ON cp_meetings (cp_id, sm_id, project_id, meeting_date);
CREATE INDEX IF NOT EXISTS cm_project_date ON cp_meetings (project_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS cm_sm_date      ON cp_meetings (sm_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS cm_cp_idx       ON cp_meetings (cp_id);

-- Back-fill eod_reports columns
CREATE TABLE IF NOT EXISTS eod_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID        NOT NULL REFERENCES sales_projects(id),
  sm_id             UUID        NOT NULL REFERENCES team_members(id),
  report_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  obm_count         INTEGER     NOT NULL DEFAULT 0,
  ibm_count         INTEGER     NOT NULL DEFAULT 0,
  unique_obm_count  INTEGER     NOT NULL DEFAULT 0,
  repeat_obm_count  INTEGER     NOT NULL DEFAULT 0,
  unique_ibm_count  INTEGER     NOT NULL DEFAULT 0,
  repeat_ibm_count  INTEGER     NOT NULL DEFAULT 0,
  calls_dialled     INTEGER     DEFAULT 0,
  calls_connected   INTEGER     DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sm_id, project_id, report_date)
);

ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS unique_obm_count  INTEGER DEFAULT 0;
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS repeat_obm_count  INTEGER DEFAULT 0;
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS unique_ibm_count  INTEGER DEFAULT 0;
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS repeat_ibm_count  INTEGER DEFAULT 0;
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS calls_dialled     INTEGER DEFAULT 0;
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS calls_connected   INTEGER DEFAULT 0;
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS notes             TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eod_sm_project_date_unique') THEN
    ALTER TABLE eod_reports ADD CONSTRAINT eod_sm_project_date_unique UNIQUE (sm_id, project_id, report_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_cpr_after_meeting()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cp_project_records (cp_id, project_id, last_meeting_date, meeting_count, created_at)
  VALUES (NEW.cp_id, NEW.project_id, NEW.meeting_date, 1, now())
  ON CONFLICT (cp_id, project_id) DO UPDATE SET
    last_meeting_date = GREATEST(cp_project_records.last_meeting_date, NEW.meeting_date),
    meeting_count     = cp_project_records.meeting_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_cpr_after_meeting ON cp_meetings;
CREATE TRIGGER trg_update_cpr_after_meeting
  AFTER INSERT ON cp_meetings
  FOR EACH ROW EXECUTE FUNCTION update_cpr_after_meeting();

ALTER TABLE cp_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_admin_all"  ON cp_meetings;
DROP POLICY IF EXISTS "cm_sm_select"  ON cp_meetings;
DROP POLICY IF EXISTS "cm_sm_insert"  ON cp_meetings;
DROP POLICY IF EXISTS "eod_admin_all" ON eod_reports;
DROP POLICY IF EXISTS "eod_sm_select" ON eod_reports;
DROP POLICY IF EXISTS "eod_sm_insert" ON eod_reports;
DROP POLICY IF EXISTS "eod_sm_update" ON eod_reports;

CREATE POLICY "cm_admin_all" ON cp_meetings
  USING (user_is_sales_admin());

CREATE POLICY "cm_sm_select" ON cp_meetings
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "cm_sm_insert" ON cp_meetings
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "eod_admin_all" ON eod_reports
  USING (user_is_sales_admin());

CREATE POLICY "eod_sm_select" ON eod_reports
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "eod_sm_insert" ON eod_reports
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "eod_sm_update" ON eod_reports
  FOR UPDATE USING (sm_id = auth.uid() AND project_id = ANY(user_assigned_project_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 0025: clients + walk_ins + site_visits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
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

-- Back-fill clients columns (all columns)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mobile_primary        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mobile_alternate      TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS salutation            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name             TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email                 TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS alternate_email       TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS age_bracket           age_bracket_enum;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender                TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS occupation            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS employment_type       employment_enum;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS designation           TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marital_status        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS family_size           INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS household_income      TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS highest_education     TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ethnicity             TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS residential_address   JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS office_address        JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name          TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_mobile_unique') THEN
    ALTER TABLE clients ADD CONSTRAINT client_mobile_unique UNIQUE (mobile_primary);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobile_10_digits') THEN
    ALTER TABLE clients ADD CONSTRAINT mobile_10_digits CHECK (mobile_primary ~ '^\d{10}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS client_mobile_idx ON clients (mobile_primary);

CREATE TABLE IF NOT EXISTS walk_ins (
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

-- Back-fill walk_ins columns (all columns, nullable to handle existing rows)
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS project_id                  UUID              REFERENCES sales_projects(id);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS client_id                   UUID              REFERENCES clients(id);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS source                      lead_source_enum;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS sub_source                  TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS cp_id                       UUID              REFERENCES channel_partners(id);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS referrer_name               TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS sourcing_sm_id              UUID              REFERENCES team_members(id);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS closing_sm_id               UUID              REFERENCES team_members(id);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS configuration               config_enum;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS budget                      TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS carpet_area                 NUMERIC(10,2);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS construction_status_pref    TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS purpose                     purpose_enum;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS possession_timeframe        TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS current_residence_status    TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS status                      lead_status_enum  DEFAULT 'cold';
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS latest_remark               TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS latest_remark_date          DATE;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS lost_reason                 lost_reason_enum;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS tele_caller_remark          TEXT;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS is_active                   BOOLEAN           DEFAULT true;
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS created_at                  TIMESTAMPTZ       DEFAULT now();
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS created_by                  UUID              REFERENCES team_members(id);
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS updated_at                  TIMESTAMPTZ       DEFAULT now();
ALTER TABLE walk_ins ADD COLUMN IF NOT EXISTS updated_by                  UUID              REFERENCES team_members(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'one_active_per_client_project') THEN
    ALTER TABLE walk_ins ADD CONSTRAINT one_active_per_client_project UNIQUE NULLS NOT DISTINCT (client_id, project_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wi_project_status    ON walk_ins (project_id, status)        WHERE is_active = true;
CREATE INDEX IF NOT EXISTS wi_project_source    ON walk_ins (project_id, source)        WHERE is_active = true;
CREATE INDEX IF NOT EXISTS wi_project_config    ON walk_ins (project_id, configuration) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS wi_cp_idx            ON walk_ins (cp_id)                     WHERE is_active = true;
CREATE INDEX IF NOT EXISTS wi_closing_sm_idx    ON walk_ins (closing_sm_id)             WHERE is_active = true;
CREATE INDEX IF NOT EXISTS wi_sourcing_sm_idx   ON walk_ins (sourcing_sm_id)            WHERE is_active = true;
CREATE INDEX IF NOT EXISTS wi_project_date      ON walk_ins (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wi_lost_reason_idx   ON walk_ins (project_id, lost_reason)   WHERE status = 'lost';

CREATE TABLE IF NOT EXISTS site_visits (
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

-- Back-fill site_visits columns (all columns)
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS walk_in_id                    UUID              REFERENCES walk_ins(id);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS client_id                     UUID              REFERENCES clients(id);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS project_id                    UUID              REFERENCES sales_projects(id);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visit_number                  INTEGER           DEFAULT 1;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visit_date                    DATE              DEFAULT CURRENT_DATE;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visit_type                    visit_type_enum   DEFAULT 'site_visit';
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS created_by                    UUID              REFERENCES team_members(id);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS accompanied_by                TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS assigned_sm_id                UUID              REFERENCES team_members(id);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS checklist_show_flat           BOOLEAN           DEFAULT false;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS checklist_sample_flat         BOOLEAN           DEFAULT false;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS checklist_av_video            BOOLEAN           DEFAULT false;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS checklist_unit_plan           BOOLEAN           DEFAULT false;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS checklist_pricing_discussion  BOOLEAN           DEFAULT false;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS checklist_site_tour           BOOLEAN           DEFAULT false;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS opportunity_stage             TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS opportunity_sub_stage         TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS sub_stage_reason              TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS next_followup_date            TIMESTAMPTZ;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS proposed_revisit_date         TIMESTAMPTZ;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS comments                      TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS gre_remarks                   TEXT;

CREATE INDEX IF NOT EXISTS sv_walk_in_idx    ON site_visits (walk_in_id);
CREATE INDEX IF NOT EXISTS sv_project_date   ON site_visits (project_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS sv_sm_idx         ON site_visits (assigned_sm_id);
CREATE INDEX IF NOT EXISTS sv_project_number ON site_visits (project_id, visit_number);

CREATE OR REPLACE FUNCTION enforce_booked_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'booked' AND NEW.status != 'booked' THEN
    IF NOT EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid() AND role::text IN ('admin', 'sales_admin')
    ) THEN
      RAISE EXCEPTION 'Cannot change status away from booked. Only admin or sales_admin can un-book.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_booked_immutable ON walk_ins;
CREATE TRIGGER trg_enforce_booked_immutable
  BEFORE UPDATE ON walk_ins
  FOR EACH ROW EXECUTE FUNCTION enforce_booked_immutable();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_walk_ins_updated_at ON walk_ins;
CREATE TRIGGER trg_walk_ins_updated_at
  BEFORE UPDATE ON walk_ins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_ins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_sales_select" ON clients;
DROP POLICY IF EXISTS "clients_sales_insert" ON clients;
DROP POLICY IF EXISTS "clients_sales_update" ON clients;
DROP POLICY IF EXISTS "wi_admin_all"         ON walk_ins;
DROP POLICY IF EXISTS "wi_sm_select"         ON walk_ins;
DROP POLICY IF EXISTS "wi_sm_insert"         ON walk_ins;
DROP POLICY IF EXISTS "wi_sm_update"         ON walk_ins;
DROP POLICY IF EXISTS "sv_admin_all"         ON site_visits;
DROP POLICY IF EXISTS "sv_sm_select"         ON site_visits;
DROP POLICY IF EXISTS "sv_sm_insert"         ON site_visits;

CREATE POLICY "clients_sales_select" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid()
        AND role::text IN ('admin','sales_admin','sales_head','sales_manager')
    )
  );

CREATE POLICY "clients_sales_insert" ON clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid()
        AND role::text IN ('admin','sales_admin','sales_head','sales_manager')
    )
  );

CREATE POLICY "clients_sales_update" ON clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE id = auth.uid()
        AND role::text IN ('admin','sales_admin','sales_head')
    )
  );

CREATE POLICY "wi_admin_all" ON walk_ins
  USING (user_is_sales_admin());

CREATE POLICY "wi_sm_select" ON walk_ins
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "wi_sm_insert" ON walk_ins
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "wi_sm_update" ON walk_ins
  FOR UPDATE USING (project_id = ANY(user_assigned_project_ids()))
  WITH CHECK (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "sv_admin_all" ON site_visits
  USING (user_is_sales_admin());

CREATE POLICY "sv_sm_select" ON site_visits
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

CREATE POLICY "sv_sm_insert" ON site_visits
  FOR INSERT WITH CHECK (project_id = ANY(user_assigned_project_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 0026: analytics views
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_cp_performance AS
SELECT
  cp.id                                           AS cp_id,
  cp.canonical_name,
  cp.category,
  cp.stage,
  w.project_id,
  COUNT(DISTINCT w.id)                            AS total_walkins,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'booked')  AS booked,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'warm')    AS warm,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'cold')    AS cold,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'lost')    AS lost,
  COUNT(DISTINCT w.id) FILTER (WHERE w.configuration = '1bhk')       AS bhk_1,
  COUNT(DISTINCT w.id) FILTER (WHERE w.configuration = '2bhk')       AS bhk_2,
  COUNT(DISTINCT w.id) FILTER (WHERE w.configuration = '3bhk')       AS bhk_3,
  COUNT(DISTINCT w.id) FILTER (WHERE w.configuration = '2bhk_jodi')  AS bhk_2_jodi,
  COUNT(sv.id) FILTER (WHERE sv.visit_number > 1)          AS revisit_count,
  COUNT(DISTINCT m.id)                                      AS dar_meetings,
  COUNT(DISTINCT m.id) FILTER (WHERE m.meeting_type = 'obm')                                    AS obm_count,
  COUNT(DISTINCT m.id) FILTER (WHERE m.meeting_type = 'obm' AND m.meeting_category = 'unique')  AS unique_obms,
  COUNT(DISTINCT m.id) FILTER (WHERE m.meeting_type = 'ibm')                                    AS ibm_count,
  ROUND(
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'booked')::NUMERIC /
    NULLIF(COUNT(DISTINCT w.id), 0) * 100, 2
  )                                                         AS conversion_pct,
  CASE
    WHEN COUNT(DISTINCT w.id) >= 10 THEN 'p1'
    WHEN COUNT(DISTINCT w.id) >= 5  THEN 'p2'
    WHEN COUNT(DISTINCT w.id) >= 1  THEN 'p3'
    ELSE NULL
  END                                                       AS computed_priority
FROM channel_partners cp
LEFT JOIN walk_ins w     ON w.cp_id = cp.id AND w.is_active = true
LEFT JOIN site_visits sv ON sv.walk_in_id = w.id
LEFT JOIN cp_meetings m  ON m.cp_id = cp.id AND m.project_id = w.project_id
GROUP BY cp.id, cp.canonical_name, cp.category, cp.stage, w.project_id;

CREATE OR REPLACE VIEW v_sm_performance AS
SELECT
  tm.id                                              AS sm_id,
  tm.full_name,
  w.project_id,
  COUNT(DISTINCT w.id)                               AS total_walkins,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'booked') AS booked,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'warm')   AS warm,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'cold')   AS cold,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'lost')   AS lost,
  COUNT(DISTINCT w.id) FILTER (WHERE w.source = 'cp')     AS cp_walkins,
  COUNT(DISTINCT w.id) FILTER (WHERE w.source = 'direct') AS direct_walkins,
  ROUND(
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'booked')::NUMERIC /
    NULLIF(COUNT(DISTINCT w.id), 0) * 100, 2
  )                                                  AS conversion_pct,
  COUNT(m.id)                                                AS total_meetings,
  COUNT(m.id) FILTER (WHERE m.meeting_type = 'obm')                                    AS total_obms,
  COUNT(m.id) FILTER (WHERE m.meeting_type = 'obm' AND m.meeting_category = 'unique')  AS unique_obms,
  COUNT(m.id) FILTER (WHERE m.meeting_type = 'obm' AND m.meeting_category = 'repeat')  AS repeat_obms,
  COUNT(m.id) FILTER (WHERE m.meeting_type = 'ibm')                                    AS total_ibms,
  COUNT(m.id) FILTER (WHERE m.meeting_type = 'ibm' AND m.meeting_category = 'unique')  AS unique_ibms
FROM team_members tm
LEFT JOIN walk_ins   w ON w.closing_sm_id = tm.id AND w.is_active = true
LEFT JOIN cp_meetings m ON m.sm_id = tm.id
WHERE tm.role::text IN ('sales_manager','sales_head','sales_admin')
GROUP BY tm.id, tm.full_name, w.project_id;

CREATE OR REPLACE VIEW v_monthly_trend AS
SELECT
  project_id,
  DATE_TRUNC('month', created_at)::DATE             AS month_start,
  TO_CHAR(created_at, 'Mon-YY')                     AS month_label,
  EXTRACT(YEAR FROM created_at)::INT * 100
    + EXTRACT(MONTH FROM created_at)::INT           AS month_sort,
  COUNT(*)                                          AS total_walkins,
  COUNT(*) FILTER (WHERE source = 'cp')             AS cp_walkins,
  COUNT(*) FILTER (WHERE source = 'direct')         AS direct_walkins,
  COUNT(*) FILTER (WHERE status = 'booked')         AS bookings
FROM walk_ins
WHERE is_active = true
GROUP BY project_id, DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon-YY'),
         EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
ORDER BY project_id, month_sort;

CREATE OR REPLACE VIEW v_lost_analysis AS
SELECT
  project_id,
  lost_reason,
  COUNT(*)                                            AS total_lost,
  COUNT(*) FILTER (WHERE source = 'cp')               AS cp_lost,
  COUNT(*) FILTER (WHERE source = 'direct')           AS direct_lost,
  COUNT(*) FILTER (WHERE configuration = '1bhk')      AS bhk_1,
  COUNT(*) FILTER (WHERE configuration = '2bhk')      AS bhk_2,
  COUNT(*) FILTER (WHERE configuration = '3bhk')      AS bhk_3,
  COUNT(*) FILTER (WHERE configuration = '2bhk_jodi') AS bhk_2_jodi,
  ROUND(
    COUNT(*)::NUMERIC /
    NULLIF(SUM(COUNT(*)) OVER (PARTITION BY project_id), 0) * 100, 2
  )                                                   AS pct_of_lost
FROM walk_ins
WHERE status = 'lost' AND is_active = true AND lost_reason IS NOT NULL
GROUP BY project_id, lost_reason
ORDER BY project_id, total_lost DESC;

CREATE OR REPLACE VIEW v_priority_leads AS
SELECT
  w.id                  AS walk_in_id,
  w.project_id,
  c.first_name,
  c.last_name,
  c.mobile_primary,
  w.source,
  w.configuration,
  w.budget,
  cp.canonical_name     AS cp_name,
  tm.full_name          AS closing_sm,
  w.status,
  w.latest_remark,
  w.latest_remark_date,
  sv_last.visit_date    AS last_visit_date,
  sv_last.visit_number,
  sv_last.comments      AS last_sm_comment,
  sv_last.proposed_revisit_date,
  CASE
    WHEN w.status = 'booked' THEN 5
    WHEN w.status = 'warm' AND w.latest_remark ILIKE '%offer%' THEN 4
    WHEN w.status = 'warm' AND w.latest_remark ILIKE '%price%' THEN 4
    WHEN w.status = 'warm' THEN 3
    WHEN w.status = 'cold' THEN 2
    ELSE 1
  END                   AS priority_score
FROM walk_ins w
JOIN     clients c        ON c.id = w.client_id
LEFT JOIN channel_partners cp ON cp.id = w.cp_id
LEFT JOIN team_members tm ON tm.id = w.closing_sm_id
LEFT JOIN LATERAL (
  SELECT * FROM site_visits sv WHERE sv.walk_in_id = w.id
  ORDER BY sv.visit_date DESC LIMIT 1
) sv_last ON true
WHERE w.status IN ('warm','cold','booked') AND w.is_active = true
ORDER BY priority_score DESC, w.latest_remark_date DESC NULLS LAST;

CREATE OR REPLACE VIEW v_config_breakdown AS
SELECT
  project_id,
  configuration,
  COUNT(*)                                            AS total,
  COUNT(*) FILTER (WHERE source = 'cp')               AS cp_count,
  COUNT(*) FILTER (WHERE source = 'direct')           AS direct_count,
  COUNT(*) FILTER (WHERE status = 'booked')           AS booked,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'booked')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2
  )                                                   AS conversion_pct,
  ROUND(
    COUNT(*)::NUMERIC /
    NULLIF(SUM(COUNT(*)) OVER (PARTITION BY project_id), 0) * 100, 2
  )                                                   AS pct_of_total
FROM walk_ins
WHERE is_active = true
GROUP BY project_id, configuration
ORDER BY project_id, total DESC;
