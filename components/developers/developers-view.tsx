'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Mail, Phone, ExternalLink, ChevronRight, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatDate, formatTimeAgo } from '@/lib/utils/formatters';
import { updateShareOutcome } from '@/lib/actions/developers';
import { DeveloperCreateSheet } from './developer-create-sheet';
import type { DeveloperWithStats, DeveloperShareFull } from '@/lib/queries/developers';

// ─── Outcome config ───────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  interested: { label: 'Interested', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  pursuing:   { label: 'Pursuing',   badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  won:        { label: 'Won',        badge: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500'  },
  passed:     { label: 'Passed',     badge: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400'    },
  pending:    { label: 'Pending',    badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400'   },
};

const OUTCOME_OPTIONS = ['interested', 'pursuing', 'won', 'passed'];

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_PALETTES = [
  { bg: 'bg-rose-100',    text: 'text-rose-700'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700'  },
  { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
  { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  { bg: 'bg-violet-100',  text: 'text-violet-700'  },
  { bg: 'bg-pink-100',    text: 'text-pink-700'    },
];

function palette(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  const key = outcome ?? 'pending';
  const cfg = OUTCOME_CONFIG[key] ?? OUTCOME_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string | null; size?: 'md' | 'lg' }) {
  const p = palette(name);
  const sz = size === 'lg' ? 'h-16 w-16 text-2xl rounded-2xl' : 'h-12 w-12 text-base rounded-xl';

  if (logoUrl) {
    return (
      <div className={`${sz} flex items-center justify-center overflow-hidden border bg-white shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain p-1.5"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  return (
    <div className={`${sz} flex items-center justify-center font-bold shrink-0 ${p.bg} ${p.text}`}>
      {initials(name)}
    </div>
  );
}

// ─── Developer card ───────────────────────────────────────────────────────────

function DeveloperCard({ dev, onClick }: { dev: DeveloperWithStats; onClick: () => void }) {
  const p = palette(dev.name);
  const outcomeEntries = Object.entries(dev.outcome_counts)
    .filter(([k, n]) => n > 0 && k !== 'pending')
    .sort(([a], [b]) => a.localeCompare(b));
  const pendingCount = dev.outcome_counts['pending'] ?? 0;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Top accent strip */}
      <div className={`h-1 w-full ${p.bg}`} />

      <div className="p-5 flex flex-col gap-4">
        {/* Identity */}
        <div className="flex items-start gap-3.5">
          <Avatar name={dev.name} logoUrl={dev.logo_url} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{dev.name}</p>
            {dev.contact_person && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{dev.contact_person}</p>
            )}
            {dev.contact_email && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{dev.contact_email}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 shrink-0 transition-colors" />
        </div>

        {/* Outcome pills */}
        {dev.share_count > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {outcomeEntries.map(([outcome, count]) => {
              const cfg = OUTCOME_CONFIG[outcome];
              return (
                <span key={outcome} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {count} {cfg.label}
                </span>
              );
            })}
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {pendingCount} Pending
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No assets shared yet</p>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
          <span>{dev.share_count} {dev.share_count === 1 ? 'asset' : 'assets'} shared</span>
          {dev.last_shared_at && (
            <span>Last {formatTimeAgo(dev.last_shared_at)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Share row (inside detail panel) ─────────────────────────────────────────

function ShareRow({ share, assetId }: { share: DeveloperShareFull; assetId?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleOutcomeChange(outcome: string) {
    startTransition(async () => {
      await updateShareOutcome(share.id, share.asset_id, outcome);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/assets/${share.asset_id}`}
            className="font-medium text-sm hover:underline underline-offset-2 flex items-center gap-1 group/link"
          >
            {share.asset_name}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-60 transition-opacity" />
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shared by {share.shared_by_name} · {formatDate(share.shared_at)}
          </p>
          {share.notes && (
            <p className="text-xs text-muted-foreground italic mt-1.5 bg-muted/40 rounded-md px-2.5 py-1.5">
              "{share.notes}"
            </p>
          )}
        </div>
        <div className="shrink-0">
          <select
            value={share.outcome ?? ''}
            disabled={isPending}
            onChange={(e) => handleOutcomeChange(e.target.value)}
            className="h-7 rounded-full border px-2.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
          >
            <option value="" disabled>Pending</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o} value={o}>{OUTCOME_CONFIG[o].label}</option>
            ))}
          </select>
        </div>
      </div>
      {share.outcome && (
        <OutcomeBadge outcome={share.outcome} />
      )}
    </div>
  );
}

// ─── Developer detail panel ───────────────────────────────────────────────────

function DeveloperPanel({ dev, onClose }: { dev: DeveloperWithStats; onClose: () => void }) {
  const p = palette(dev.name);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`${p.bg} px-6 pt-8 pb-6 shrink-0`}>
          <div className="flex items-start gap-4">
            <Avatar name={dev.name} logoUrl={dev.logo_url} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className={`text-lg font-bold leading-tight ${p.text}`}>{dev.name}</h2>
              {dev.contact_person && (
                <p className="text-sm text-foreground/70 mt-0.5">{dev.contact_person}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                Added {formatDate(dev.created_at)}
              </p>
            </div>
          </div>

          {/* Contact info */}
          {(dev.contact_email || dev.contact_phone) && (
            <div className="flex flex-col gap-1.5 mt-4">
              {dev.contact_email && (
                <a
                  href={`mailto:${dev.contact_email}`}
                  className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {dev.contact_email}
                </a>
              )}
              {dev.contact_phone && (
                <span className="inline-flex items-center gap-2 text-sm text-foreground/80">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {dev.contact_phone}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Outcome summary */}
        {dev.share_count > 0 && (
          <div className="px-6 py-4 border-b shrink-0">
            <div className="flex flex-wrap gap-2">
              {Object.entries(dev.outcome_counts)
                .filter(([, n]) => n > 0)
                .map(([outcome, count]) => {
                  const cfg = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.pending;
                  return (
                    <span key={outcome} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.badge}`}>
                      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      {count} {cfg.label}
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {/* Notes */}
        {dev.notes && (
          <div className="px-6 py-4 border-b shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</p>
            <p className="text-sm text-muted-foreground">{dev.notes}</p>
          </div>
        )}

        {/* Shared assets */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Shared Assets {dev.share_count > 0 && `· ${dev.share_count}`}
          </p>
          {dev.shares.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assets shared with this developer yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {dev.shares.map((s) => (
                <ShareRow key={s.id} share={s} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function DevelopersView({ developers }: { developers: DeveloperWithStats[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DeveloperWithStats | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return developers;
    return developers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.contact_person?.toLowerCase().includes(q) ||
        d.contact_email?.toLowerCase().includes(q)
    );
  }, [developers, query]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search developers…"
            className="pl-9"
          />
        </div>
        <DeveloperCreateSheet />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Building2 className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {query ? 'No developers match your search' : 'No developers yet'}
          </p>
          {!query && (
            <p className="text-xs mt-1 opacity-70">Add your first developer to get started</p>
          )}
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((dev) => (
          <DeveloperCard key={dev.id} dev={dev} onClick={() => setSelected(dev)} />
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <DeveloperPanel dev={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
