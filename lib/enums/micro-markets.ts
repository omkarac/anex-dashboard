export type MicroMarket = {
  value: string;
  label: string;
  zone: string;
};

export const MICRO_MARKETS: MicroMarket[] = [
  // South Mumbai
  { value: 'cuffe_parade',    label: 'Cuffe Parade',        zone: 'South Mumbai' },
  { value: 'nariman_point',   label: 'Nariman Point',       zone: 'South Mumbai' },
  { value: 'churchgate',      label: 'Churchgate',          zone: 'South Mumbai' },
  { value: 'fort',            label: 'Fort / CST',          zone: 'South Mumbai' },
  { value: 'marine_lines',    label: 'Marine Lines',        zone: 'South Mumbai' },
  { value: 'grant_road',      label: 'Grant Road',          zone: 'South Mumbai' },
  { value: 'byculla',         label: 'Byculla',             zone: 'South Mumbai' },
  { value: 'parel',           label: 'Parel',               zone: 'South Mumbai' },
  { value: 'lower_parel',     label: 'Lower Parel',         zone: 'South Mumbai' },
  { value: 'worli',           label: 'Worli',               zone: 'South Mumbai' },
  { value: 'dadar',           label: 'Dadar',               zone: 'South Mumbai' },
  { value: 'matunga',         label: 'Matunga',             zone: 'South Mumbai' },
  { value: 'mahim',           label: 'Mahim',               zone: 'South Mumbai' },

  // BKC & Bandra
  { value: 'bkc',             label: 'BKC',                 zone: 'BKC & Bandra' },
  { value: 'bandra_west',     label: 'Bandra West',         zone: 'BKC & Bandra' },
  { value: 'bandra_east',     label: 'Bandra East',         zone: 'BKC & Bandra' },
  { value: 'khar_west',       label: 'Khar West',           zone: 'BKC & Bandra' },
  { value: 'santa_cruz_west', label: 'Santa Cruz West',     zone: 'BKC & Bandra' },
  { value: 'santa_cruz_east', label: 'Santa Cruz East',     zone: 'BKC & Bandra' },
  { value: 'juhu',            label: 'Juhu',                zone: 'BKC & Bandra' },

  // Western Suburbs
  { value: 'vile_parle_west', label: 'Vile Parle West',     zone: 'Western Suburbs' },
  { value: 'vile_parle_east', label: 'Vile Parle East',     zone: 'Western Suburbs' },
  { value: 'andheri_west',    label: 'Andheri West',        zone: 'Western Suburbs' },
  { value: 'andheri_east',    label: 'Andheri East / JVLR', zone: 'Western Suburbs' },
  { value: 'versova',         label: 'Versova',             zone: 'Western Suburbs' },
  { value: 'jogeshwari',      label: 'Jogeshwari',          zone: 'Western Suburbs' },
  { value: 'goregaon',        label: 'Goregaon',            zone: 'Western Suburbs' },
  { value: 'malad',           label: 'Malad',               zone: 'Western Suburbs' },
  { value: 'kandivali',       label: 'Kandivali',           zone: 'Western Suburbs' },
  { value: 'borivali',        label: 'Borivali',            zone: 'Western Suburbs' },
  { value: 'dahisar',         label: 'Dahisar',             zone: 'Western Suburbs' },

  // Eastern Suburbs
  { value: 'powai',           label: 'Powai',               zone: 'Eastern Suburbs' },
  { value: 'chembur',         label: 'Chembur',             zone: 'Eastern Suburbs' },
  { value: 'kurla',           label: 'Kurla',               zone: 'Eastern Suburbs' },
  { value: 'ghatkopar',       label: 'Ghatkopar',           zone: 'Eastern Suburbs' },
  { value: 'vikhroli',        label: 'Vikhroli',            zone: 'Eastern Suburbs' },
  { value: 'kanjurmarg',      label: 'Kanjurmarg',          zone: 'Eastern Suburbs' },
  { value: 'bhandup',         label: 'Bhandup',             zone: 'Eastern Suburbs' },
  { value: 'mulund',          label: 'Mulund',              zone: 'Eastern Suburbs' },
  { value: 'govandi',         label: 'Govandi',             zone: 'Eastern Suburbs' },

  // Thane
  { value: 'thane_west',      label: 'Thane West',          zone: 'Thane' },
  { value: 'thane_east',      label: 'Thane East',          zone: 'Thane' },
  { value: 'ghodbunder_road', label: 'Ghodbunder Road',     zone: 'Thane' },
  { value: 'majiwada',        label: 'Majiwada',            zone: 'Thane' },
  { value: 'balkum',          label: 'Balkum',              zone: 'Thane' },
  { value: 'kalwa',           label: 'Kalwa',               zone: 'Thane' },

  // Navi Mumbai
  { value: 'vashi',           label: 'Vashi',               zone: 'Navi Mumbai' },
  { value: 'nerul',           label: 'Nerul',               zone: 'Navi Mumbai' },
  { value: 'belapur',         label: 'CBD Belapur',         zone: 'Navi Mumbai' },
  { value: 'kharghar',        label: 'Kharghar',            zone: 'Navi Mumbai' },
  { value: 'panvel',          label: 'Panvel',              zone: 'Navi Mumbai' },
  { value: 'ulwe',            label: 'Ulwe',                zone: 'Navi Mumbai' },
  { value: 'dronagiri',       label: 'Dronagiri / NMSEZ',   zone: 'Navi Mumbai' },

  // MMR Extended
  { value: 'mira_road',       label: 'Mira Road',           zone: 'MMR Extended' },
  { value: 'bhayander',       label: 'Bhayander',           zone: 'MMR Extended' },
  { value: 'vasai',           label: 'Vasai',               zone: 'MMR Extended' },
  { value: 'virar',           label: 'Virar',               zone: 'MMR Extended' },
  { value: 'kalyan',          label: 'Kalyan',              zone: 'MMR Extended' },
  { value: 'dombivli',        label: 'Dombivli',            zone: 'MMR Extended' },
  { value: 'ambernath',       label: 'Ambernath',           zone: 'MMR Extended' },
  { value: 'bhiwandi',        label: 'Bhiwandi',            zone: 'MMR Extended' },
];

export const MICRO_MARKET_MAP = new Map(MICRO_MARKETS.map((m) => [m.value, m]));

export const MICRO_MARKET_ZONES = [...new Set(MICRO_MARKETS.map((m) => m.zone))];

export function getMicroMarketLabel(value: string): string {
  return MICRO_MARKET_MAP.get(value)?.label ?? value;
}

export function getMicroMarketZone(value: string): string {
  return MICRO_MARKET_MAP.get(value)?.zone ?? 'Unknown';
}

export function microMarketsByZone(): Map<string, MicroMarket[]> {
  const map = new Map<string, MicroMarket[]>();
  for (const m of MICRO_MARKETS) {
    const arr = map.get(m.zone) ?? [];
    arr.push(m);
    map.set(m.zone, arr);
  }
  return map;
}
