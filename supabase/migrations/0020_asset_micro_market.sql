-- Add micro_market column to assets.
-- Stores canonical micro-market slug (matches MICRO_MARKET_COORDS keys).
-- Nullable so existing rows are not broken; backfill below covers known patterns.

alter table assets add column micro_market text;

-- One-time backfill: map existing free-text location values to canonical slugs.
-- Longer/more-specific patterns must come before shorter ones to avoid false matches.
update assets set micro_market = case
  -- South Mumbai
  when lower(location) like '%cuffe parade%'              then 'cuffe_parade'
  when lower(location) like '%nariman point%'             then 'nariman_point'
  when lower(location) like '%churchgate%'                then 'churchgate'
  when lower(location) like '%fort%' or lower(location) like '%cst%' then 'fort'
  when lower(location) like '%marine lines%'              then 'marine_lines'
  when lower(location) like '%grant road%'                then 'grant_road'
  when lower(location) like '%byculla%'                   then 'byculla'
  when lower(location) like '%lower parel%'               then 'lower_parel'
  when lower(location) like '%parel%'                     then 'parel'
  when lower(location) like '%worli%'                     then 'worli'
  when lower(location) like '%dadar%'                     then 'dadar'
  when lower(location) like '%matunga%'                   then 'matunga'
  when lower(location) like '%mahim%'                     then 'mahim'
  -- BKC & Bandra
  when lower(location) like '%bkc%' or lower(location) like '%bandra kurla%' then 'bkc'
  when lower(location) like '%bandra west%'               then 'bandra_west'
  when lower(location) like '%bandra east%'               then 'bandra_east'
  when lower(location) like '%bandra%'                    then 'bandra_west'
  when lower(location) like '%khar%'                      then 'khar_west'
  when lower(location) like '%santa cruz west%'           then 'santa_cruz_west'
  when lower(location) like '%santa cruz east%'           then 'santa_cruz_east'
  when lower(location) like '%santa cruz%'                then 'santa_cruz_west'
  when lower(location) like '%juhu%'                      then 'juhu'
  -- Western Suburbs
  when lower(location) like '%vile parle west%'           then 'vile_parle_west'
  when lower(location) like '%vile parle east%'           then 'vile_parle_east'
  when lower(location) like '%vile parle%'                then 'vile_parle_west'
  when lower(location) like '%andheri west%'              then 'andheri_west'
  when lower(location) like '%andheri east%' or lower(location) like '%jvlr%' then 'andheri_east'
  when lower(location) like '%andheri%'                   then 'andheri_west'
  when lower(location) like '%versova%'                   then 'versova'
  when lower(location) like '%jogeshwari%'                then 'jogeshwari'
  when lower(location) like '%goregaon%'                  then 'goregaon'
  when lower(location) like '%malad%'                     then 'malad'
  when lower(location) like '%kandivali%'                 then 'kandivali'
  when lower(location) like '%borivali%'                  then 'borivali'
  when lower(location) like '%dahisar%'                   then 'dahisar'
  -- Eastern Suburbs
  when lower(location) like '%powai%'                     then 'powai'
  when lower(location) like '%chembur%'                   then 'chembur'
  when lower(location) like '%kurla%'                     then 'kurla'
  when lower(location) like '%ghatkopar%'                 then 'ghatkopar'
  when lower(location) like '%vikhroli%'                  then 'vikhroli'
  when lower(location) like '%kanjurmarg%'                then 'kanjurmarg'
  when lower(location) like '%bhandup%'                   then 'bhandup'
  when lower(location) like '%mulund%'                    then 'mulund'
  when lower(location) like '%govandi%'                   then 'govandi'
  -- Thane
  when lower(location) like '%ghodbunder%'                then 'ghodbunder_road'
  when lower(location) like '%majiwada%'                  then 'majiwada'
  when lower(location) like '%balkum%'                    then 'balkum'
  when lower(location) like '%kalwa%'                     then 'kalwa'
  when lower(location) like '%thane west%'                then 'thane_west'
  when lower(location) like '%thane east%'                then 'thane_east'
  when lower(location) like '%thane%'                     then 'thane_west'
  -- Navi Mumbai
  when lower(location) like '%vashi%'                     then 'vashi'
  when lower(location) like '%nerul%'                     then 'nerul'
  when lower(location) like '%belapur%'                   then 'belapur'
  when lower(location) like '%kharghar%'                  then 'kharghar'
  when lower(location) like '%panvel%'                    then 'panvel'
  when lower(location) like '%ulwe%'                      then 'ulwe'
  when lower(location) like '%dronagiri%' or lower(location) like '%nmsez%' then 'dronagiri'
  -- MMR Extended
  when lower(location) like '%mira road%'                 then 'mira_road'
  when lower(location) like '%bhayander%' or lower(location) like '%bhayandar%' then 'bhayander'
  when lower(location) like '%vasai%'                     then 'vasai'
  when lower(location) like '%virar%'                     then 'virar'
  when lower(location) like '%dombivli%'                  then 'dombivli'
  when lower(location) like '%ambernath%'                 then 'ambernath'
  when lower(location) like '%bhiwandi%'                  then 'bhiwandi'
  when lower(location) like '%kalyan%'                    then 'kalyan'
  else null
end
where location is not null and micro_market is null;

create index on assets (micro_market) where deleted_at is null;
