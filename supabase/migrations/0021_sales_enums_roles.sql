-- 0021_sales_enums_roles.sql
-- Sales & Marketing vertical: enums, role extensions, RLS helpers

-- Enable trigram extension for fuzzy CP search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Extend role_enum with sales roles
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'sales_head';
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'sales_admin';

-- ── Sales enums ───────────────────────────────────────────────────────────────

CREATE TYPE lead_status_enum AS ENUM ('hot','warm','cold','lost','booked');
CREATE TYPE lead_source_enum AS ENUM ('cp','direct');
CREATE TYPE meeting_type_enum AS ENUM ('obm','ibm');
CREATE TYPE meeting_cat_enum AS ENUM ('unique','repeat');
CREATE TYPE config_enum AS ENUM ('1bhk','2bhk','3bhk','2bhk_jodi','duplex','2_3bhk','commercial');
CREATE TYPE cp_category_enum AS ENUM ('icp','rcp','cp');
CREATE TYPE cp_stage_enum AS ENUM ('prospect','active','inactive');
CREATE TYPE cp_sub_stage_enum AS ENUM ('high_potential','low_potential','walkin_active','sourcing_active','inactive');
CREATE TYPE lost_reason_enum AS ENUM (
  'not_responding','budget','booked_elsewhere','plan_dropped','didnt_like_project',
  'layout_issue','requirement_mismatch','not_interested','general_enquiry',
  'location_issue','floor_issue','possession_timeline','vaastu_issue','view_issue','other'
);
CREATE TYPE age_bracket_enum AS ENUM ('below_25','25_30','31_40','41_50','51_60','above_60');
CREATE TYPE purpose_enum AS ENUM ('self_use','investment','both');
CREATE TYPE employment_enum AS ENUM ('salaried','self_employed','business_owner','retired','student','other');
CREATE TYPE visit_type_enum AS ENUM ('site_visit','home_visit','video_call','office_visit');
CREATE TYPE cp_firm_type_enum AS ENUM ('individual','private_limited','public_limited','partnership','llp','proprietorship');
CREATE TYPE zone_enum AS ENUM ('kdmc','thane','central','navi_mumbai','south_mumbai','western_suburbs','eastern_suburbs','other');

-- ── RLS helper functions ──────────────────────────────────────────────────────

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