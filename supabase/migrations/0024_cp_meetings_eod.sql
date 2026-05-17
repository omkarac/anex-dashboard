-- 0024_cp_meetings_eod.sql
-- cp_meetings + eod_reports tables

CREATE TABLE cp_meetings (
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

CREATE INDEX cm_month_lookup ON cp_meetings (cp_id, sm_id, project_id, meeting_date);
CREATE INDEX cm_project_date ON cp_meetings (project_id, meeting_date DESC);
CREATE INDEX cm_sm_date      ON cp_meetings (sm_id, meeting_date DESC);
CREATE INDEX cm_cp_idx       ON cp_meetings (cp_id);

CREATE TABLE eod_reports (
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

-- Trigger: update cp_project_records activity summary after meeting insert
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

CREATE TRIGGER trg_update_cpr_after_meeting
  AFTER INSERT ON cp_meetings
  FOR EACH ROW EXECUTE FUNCTION update_cpr_after_meeting();

-- RLS
ALTER TABLE cp_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;

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
