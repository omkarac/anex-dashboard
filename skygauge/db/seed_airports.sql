-- MMR airport seed data
-- Sources:
--   CSMIA (Santa Cruz / VABB): AAI eAIP aerodrome chart, AIP India
--   Juhu (VAJJ): AAI eAIP
--   Navi Mumbai (NMIA / VANM): pre-operational; coordinates from project planning documents
--
-- Run AFTER schema.sql.
-- Idempotent: uses ON CONFLICT (code) DO UPDATE so re-running won't duplicate.

insert into airports (code, name, aai_id, arp_lat, arp_lon, elevation_m, ols_code, runways, active, notes)
values
    (
        'VABB',
        'Chhatrapati Shivaji Maharaj International Airport (Santa Cruz)',
        15,
        19.0916944,                 -- 19° 05' 30.10" N (DMS 19 05 29.6 ~= 19.09155)
        72.8654722,                 -- 72° 51' 55.70" E
        11.28,                      -- 37 ft AMSL
        '4-PA',
        jsonb_build_array(
            jsonb_build_object(
                'designator', '09/27',
                'threshold_a', jsonb_build_object('name','09','lat',19.0931,'lon',72.8516,'elev_m',11.0),
                'threshold_b', jsonb_build_object('name','27','lat',19.0857,'lon',72.8836,'elev_m',9.5),
                'length_m', 3445,
                'width_m', 60,
                'true_bearing', 92.1,
                'surface', 'asphalt'
            ),
            jsonb_build_object(
                'designator', '14/32',
                'threshold_a', jsonb_build_object('name','14','lat',19.1022,'lon',72.8641,'elev_m',8.5),
                'threshold_b', jsonb_build_object('name','32','lat',19.0793,'lon',72.8836,'elev_m',10.7),
                'length_m', 2925,
                'width_m', 45,
                'true_bearing', 142.6,
                'surface', 'asphalt'
            )
        ),
        true,
        'Primary MMR airport. Both runways are precision-approach Code 4. ARP per AAI eAIP.'
    ),
    (
        'VAJJ',
        'Juhu Aerodrome',
        16,
        19.0967,                    -- ARP approximate
        72.8347,
        4.5,                        -- 15 ft AMSL
        '2-NPA',
        jsonb_build_array(
            jsonb_build_object(
                'designator', '08/26',
                'threshold_a', jsonb_build_object('name','08','lat',19.0966,'lon',72.8311,'elev_m',4.5),
                'threshold_b', jsonb_build_object('name','26','lat',19.0968,'lon',72.8389,'elev_m',4.5),
                'length_m', 1143,
                'width_m', 23,
                'true_bearing', 79.5,
                'surface', 'asphalt'
            ),
            jsonb_build_object(
                'designator', '03/21',
                'threshold_a', jsonb_build_object('name','03','lat',19.0950,'lon',72.8334,'elev_m',4.5),
                'threshold_b', jsonb_build_object('name','21','lat',19.0982,'lon',72.8361,'elev_m',4.5),
                'length_m', 700,
                'width_m', 23,
                'true_bearing', 33.5,
                'surface', 'asphalt'
            )
        ),
        true,
        'General aviation. Smaller OLS footprint than CSMIA. Code 2 non-precision.'
    ),
    (
        'VANM',
        'Navi Mumbai International Airport',
        140,
        19.0567,                    -- ARP per project planning (Ulwe / Panvel area)
        73.0250,
        3.0,                        -- approximate, near sea level
        '4-PA',
        jsonb_build_array(
            jsonb_build_object(
                'designator', '08/26',
                'threshold_a', jsonb_build_object('name','08','lat',19.0567,'lon',73.0070,'elev_m',3.0),
                'threshold_b', jsonb_build_object('name','26','lat',19.0567,'lon',73.0430,'elev_m',3.0),
                'length_m', 3700,
                'width_m', 60,
                'true_bearing', 80.0,
                'surface', 'asphalt'
            )
        ),
        true,
        'Pre-operational at time of v1 build. First flights expected 2024-25. Coordinates approximate, refine when AIP charts publish.'
    )
on conflict (code) do update set
    name        = excluded.name,
    aai_id      = excluded.aai_id,
    arp_lat     = excluded.arp_lat,
    arp_lon     = excluded.arp_lon,
    elevation_m = excluded.elevation_m,
    ols_code    = excluded.ols_code,
    runways     = excluded.runways,
    active      = excluded.active,
    notes       = excluded.notes,
    updated_at  = now();

-- Verify
select code, name, aai_id, arp_lat, arp_lon, elevation_m,
       jsonb_array_length(runways) as runway_count
from airports
order by code;
