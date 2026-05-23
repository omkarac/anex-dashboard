// DB stores monetary values in rupees; 1 Crore = 10^7 rupees
export const CR_SCALE = 1e7;

export function toCr(rupees: number | null | undefined): number | null {
  if (rupees == null) return null;
  return rupees / CR_SCALE;
}

export function fromCr(crore: number): number {
  return crore * CR_SCALE;
}

// Area unit conversion. DB stores areas in square metres.
export const SQFT_PER_SQM = 10.7639;

export function sqftToSqm(sqft: number): number {
  return sqft / SQFT_PER_SQM;
}

export function sqmToSqft(sqm: number): number {
  return sqm * SQFT_PER_SQM;
}

// All date/time display and "today" math is anchored to IST (Asia/Kolkata),
// regardless of server timezone, so it's consistent in dev and on Vercel (UTC).
export const IST_TZ = 'Asia/Kolkata';

// 'YYYY-MM-DD' (IST calendar date) for any instant. Use for date-only
// comparisons/grouping instead of toISOString().slice(0,10), which is UTC.
export function istDateISO(date: string | number | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

// 'YYYY-MM-DD' for "today" in IST. Use for date-field defaults, min/max, and
// overdue comparisons — never new Date().toISOString().slice(0,10), which is UTC.
export function istTodayISO(): string {
  return istDateISO(new Date());
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
