-- 0026_analytics_views.sql
-- All analytics views for the Sales & Marketing vertical

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
LEFT JOIN walk_ins w  ON w.cp_id = cp.id AND w.is_active = true
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
LEFT JOIN walk_ins  w ON w.closing_sm_id = tm.id AND w.is_active = true
LEFT JOIN cp_meetings m ON m.sm_id = tm.id
WHERE tm.role IN ('sales_manager','sales_head','sales_admin')
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
