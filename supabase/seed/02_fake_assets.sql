-- Run this AFTER 0002_assets migration and after admin has logged in once.
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM team_members WHERE email = 'omkar.chaudhari@anexadvisory.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Log in as omkar.chaudhari@anexadvisory.com first.';
  END IF;

  INSERT INTO assets (
    property_name, location, status, temperature, asset_type,
    spoc_agent, resource, plot_size_sqm, fsi_potential, regulations,
    development_potential_sqm, rehab_area_sqm, sale_area_sqm,
    sale_rate_psf, initial_investment_cr, topline_cr, profit_cr,
    next_step, created_by
  ) VALUES
  (
    'Dadar TT Redevelopment', 'Dadar West, Mumbai',
    'evaluating', 'hot', 'redevelopment',
    'Ramesh Nair', 'Direct Owner', 2450.00, 3.000, ARRAY['33(7)'],
    7350.00, 4200.00, 3150.00, 28000.00, 45.00, 180.00, 135.00,
    'Submit feasibility report to management by Apr 30', admin_id
  ),
  (
    'Andheri East JV Plot', 'Andheri East, Mumbai',
    'evaluated', 'warm', 'jv_jd',
    'Priya Shah', 'Broker Referral', 5200.00, 2.500, ARRAY['33(7B)', '33(20B)'],
    13000.00, NULL, 13000.00, 22000.00, 80.00, 286.00, 206.00,
    'Awaiting JV term sheet from landowner', admin_id
  ),
  (
    'Bandra Linking Road Outright', 'Bandra West, Mumbai',
    'initial_assessment', 'hot', 'outright',
    'Amit Joshi', 'Network', 800.00, 5.000, ARRAY['30(A)'],
    4000.00, NULL, 4000.00, 65000.00, 120.00, 260.00, 140.00,
    'One-pager being prepared', admin_id
  ),
  (
    'Malad SRA Scheme', 'Malad West, Mumbai',
    'on_hold', 'cold', 'sra',
    'Deepak Verma', 'Society Contact', 12000.00, 4.000, ARRAY['33(10)', '33(7)'],
    48000.00, 32000.00, 16000.00, 12000.00, 95.00, 192.00, 97.00,
    'Revive after society AGM in June', admin_id
  ),
  (
    'Thane Open Land Parcel', 'Thane West, Thane',
    'new', 'none', 'open_land',
    'Kavita Menon', 'Direct', 18500.00, 1.500, ARRAY['UDCPR'],
    27750.00, NULL, 27750.00, 8500.00, 55.00, 235.00, 180.00,
    NULL, admin_id
  );

END $$;
