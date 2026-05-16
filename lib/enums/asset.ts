import type { AssetStatus, AssetTemperature, AssetType } from '@/lib/schemas/asset';

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  open: 'Open',
  evaluating: 'Evaluating',
  screened: 'Screened',
  won: 'Won',
  dropped: 'Dropped',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  open: 'bg-sky-50 text-sky-700 border-sky-200',
  evaluating: 'bg-amber-50 text-amber-700 border-amber-200',
  screened: 'bg-violet-50 text-violet-700 border-violet-200',
  won: 'bg-green-50 text-green-700 border-green-200',
  dropped: 'bg-red-50 text-red-600 border-red-200',
};

export const ASSET_TEMPERATURE_LABELS: Record<AssetTemperature, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  none: '—',
};

export const ASSET_TEMPERATURE_COLORS: Record<AssetTemperature, string> = {
  hot: 'bg-red-50 text-red-600 border-red-200',
  warm: 'bg-amber-50 text-amber-600 border-amber-200',
  cold: 'bg-sky-50 text-sky-600 border-sky-200',
  none: 'bg-transparent text-muted-foreground border-transparent',
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  redevelopment: 'Redevelopment',
  outright: 'Outright',
  jv_jd: 'JV/JD',
  sra: 'SRA',
  mhada_redevelopment: 'MHADA Redevelopment',
  open_land: 'Open Land',
  funding: 'Funding',
  other: 'Other',
};

export const REGULATION_OPTIONS = [
  '33(5)', '33(7)', '33(7B)', '33(9)', '33(10)', '33(11)',
  '33(12B)', '33(19)', '33(20B)', '30(A)', '17(1)',
  'AR', 'UDCPR', 'UDCPR_plotted', 'to_be_evaluated', 'other',
];
