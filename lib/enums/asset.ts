import type { AssetStatus, AssetTemperature, AssetType } from '@/lib/schemas/asset';

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  new: 'New',
  initial_assessment: 'Initial Assessment',
  evaluating: 'Evaluating',
  evaluated: 'Evaluated',
  shared_with_developer: 'Shared w/ Developer',
  on_hold: 'On Hold',
  won: 'Won',
  dropped: 'Dropped',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  new: 'bg-slate-100 text-slate-600 border-slate-200',
  initial_assessment: 'bg-blue-50 text-blue-700 border-blue-200',
  evaluating: 'bg-amber-50 text-amber-700 border-amber-200',
  evaluated: 'bg-orange-50 text-orange-700 border-orange-200',
  shared_with_developer: 'bg-purple-50 text-purple-700 border-purple-200',
  on_hold: 'bg-gray-100 text-gray-500 border-gray-200',
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
