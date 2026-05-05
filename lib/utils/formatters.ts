// DB stores monetary values in rupees; 1 Crore = 10^7 rupees
export const CR_SCALE = 1e7;

export function toCr(rupees: number | null | undefined): number | null {
  if (rupees == null) return null;
  return rupees / CR_SCALE;
}

export function fromCr(crore: number): number {
  return crore * CR_SCALE;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd} ${mon} ${yy}`;
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mon} ${yy}, ${hh}:${min}`;
}

export function formatCr(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN')} Cr`;
}

export function formatSqm(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toLocaleString('en-IN')} sq.m.`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

export function formatPsf(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN')}/sq.ft.`;
}

export function formatTimeAgo(date: string | null | undefined): string {
  return formatDateTime(date);
}
