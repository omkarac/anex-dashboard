-- 0022_sales_projects.sql
-- sales_projects + project_sm_assignments tables

CREATE TABLE sales_projects (
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

CREATE TABLE project_sm_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES sales_projects(id),
  sm_id         UUID        NOT NULL REFERENCES team_members(id),
  sm_role       TEXT        NOT NULL DEFAULT 'both',
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by   UUID        REFERENCES team_members(id),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (project_id, sm_id)
);

-- RLS
ALTER TABLE sales_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sm_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_projects_admin_all" ON sales_projects
  USING (user_is_sales_admin());

CREATE POLICY "sales_projects_sm_select" ON sales_projects
  FOR SELECT USING (id = ANY(user_assigned_project_ids()));

CREATE POLICY "psa_admin_all" ON project_sm_assignments
  USING (user_is_sales_admin());

CREATE POLICY "psa_sm_select" ON project_sm_assignments
  FOR SELECT USING (project_id = ANY(user_assigned_project_ids()));

-- Seed: 7 Folds project (created_by first admin — handle missing admin gracefully)
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM team_members WHERE role = 'admin' LIMIT 1;
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
