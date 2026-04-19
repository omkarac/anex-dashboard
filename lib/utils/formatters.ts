// DB stores monetary values in rupees; 1 Crore = 10^7 rupees
export const CR_SCALE = 1e7;

export function toCr(rupees: number | null | undefined): number | null {
  if (rupees == null) return null;
  return rupees / CR_SCALE;
}

export function fromCr(crore: number): number {
  return crore * CR_SCALE;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
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
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}
