'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, ExternalLink, ChevronLeft, Building2 } from 'lucide-react';
import { formatDate, formatTimeAgo } from '@/lib/utils/formatters';
import { updateShareOutcome, updateShareNotes } from '@/lib/actions/developers';
import type { DeveloperWithStats, DeveloperShareFull } from '@/lib/queries/developers';

function useDominantColor(imageUrl: string | null | undefined): string | null {
  const [rgb, setRgb] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!imageUrl) { setRgb(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 80; canvas.height = 80;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 80, 80);
        const { data } = ctx.getImageData(0, 0, 80, 80);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 235 || brightness < 20) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (n > 20) setRgb(`${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}`);
      } catch {
        // CORS-tainted canvas — skip colour extraction
      }
    };
    img.onerror = () => setRgb(null);
    img.src = imageUrl;
  }, [imageUrl]);

  return rgb;
}

const OUTCOME_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  interested: { label: 'Interested', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  pursuing:   { label: 'Pursuing',   badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  won:        { label: 'Won',        badge: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500'  },
  passed:     { label: 'Passed',     badge: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400'    },
  pending:    { label: 'Pending',    badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400'   },
};

const OUTCOME_OPTIONS = ['interested', 'pursuing', 'won', 'passed'];

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

function DeveloperAvatar({ name, logoUrl, size = 'lg' }: { name: string; logoUrl?: string | null; size?: 'sm' | 'lg' }) {
  const p = palette(name);
  const sz = size === 'lg' ? 'h-16 w-16 text-2xl rounded-2xl' : 'h-10 w-10 text-base rounded-xl';

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

function ShareRow({ share }: { share: DeveloperShareFull }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(share.notes ?? '');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  function handleOutcomeChange(outcome: string) {
    startTransition(async () => {
      await updateShareOutcome(share.id, share.asset_id, outcome);
      router.refresh();
    });
  }

  function startNotesEdit() {
    setEditingNotes(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function saveNotes() {
    const trimmed = notes.trim() || null;
    setEditingNotes(false);
    startTransition(async () => {
      await updateShareNotes(share.id, share.asset_id, trimmed);
      router.refresh();
    });
  }

  function cancelNotes() {
    setNotes(share.notes ?? '');
    setEditingNotes(false);
  }

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/capital-markets/assets/${share.asset_id}`}
            className="font-medium text-sm hover:underline underline-offset-2 flex items-center gap-1 group/link"
          >
            {share.asset_name}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-60 transition-opacity" />
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shared by {share.shared_by_name} · {formatDate(share.shared_at)}
          </p>

          <div className="mt-1.5">
            {editingNotes ? (
              <div className="flex flex-col gap-1">
                <textarea
                  ref={textareaRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNotes(); }
                    if (e.key === 'Escape') cancelNotes();
                  }}
                  rows={2}
                  placeholder="Add a note…"
                  className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1.5">
                  <button onClick={saveNotes} disabled={isPending} className="text-xs text-primary hover:underline disabled:opacity-50">Save</button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button onClick={cancelNotes} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                </div>
              </div>
            ) : notes ? (
              <button
                onClick={startNotesEdit}
                className="group/note w-full text-left text-xs text-muted-foreground italic bg-muted/40 hover:bg-muted/70 rounded-md px-2.5 py-1.5 transition-colors"
              >
                &ldquo;{notes}&rdquo;
                <span className="ml-1.5 opacity-0 group-hover/note:opacity-60 text-[10px] not-italic transition-opacity">edit</span>
              </button>
            ) : (
              <button onClick={startNotesEdit} className="text-xs text-muted-foreground/40 hover:text-muted-foreground italic transition-colors">
                + add note
              </button>
            )}
          </div>
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
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium w-fit ${OUTCOME_CONFIG[share.outcome]?.badge ?? ''}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${OUTCOME_CONFIG[share.outcome]?.dot ?? ''}`} />
          {OUTCOME_CONFIG[share.outcome]?.label ?? share.outcome}
        </span>
      )}
    </div>
  );
}

export function DeveloperDetailView({ dev }: { dev: DeveloperWithStats }) {
  const p = palette(dev.name);
  const dominantRgb = useDominantColor(dev.logo_url);

  const outcomeEntries = Object.entries(dev.outcome_counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col h-full">
      {/* Hero header */}
      <div className="relative border-b shrink-0 overflow-hidden">
        {/* Blurred background layer */}
        {dev.logo_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dev.logo_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
              style={{ filter: 'blur(28px) saturate(180%)', transform: 'scale(1.5)', opacity: 0.35 }}
            />
            <div className="absolute inset-0 bg-background/55" />
            {dominantRgb && (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, rgba(${dominantRgb},0.22) 0%, rgba(${dominantRgb},0.06) 100%)` }}
              />
            )}
          </>
        ) : (
          <div className={`absolute inset-0 opacity-40 ${p.bg}`} />
        )}

        {/* Foreground content */}
        <div className="relative px-6 pt-4 pb-6">
          <Link
            href="/capital-markets/developers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Developers
          </Link>

          <div className="flex items-end gap-5">
            <DeveloperAvatar name={dev.name} logoUrl={dev.logo_url} size="lg" />
            <div className="flex-1 min-w-0 pb-0.5">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">{dev.name}</h1>
              {dev.contact_person && (
                <p className="text-sm text-muted-foreground mt-0.5">{dev.contact_person}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-2">
                {dev.contact_email && (
                  <a
                    href={`mailto:${dev.contact_email}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {dev.contact_email}
                  </a>
                )}
                {dev.contact_phone && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {dev.contact_phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{dev.share_count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Assets Shared</p>
            </div>
            {outcomeEntries.map(([outcome, count]) => {
              const cfg = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.pending;
              return (
                <div key={outcome} className={`rounded-xl border p-4 text-center ${cfg.badge}`}>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                  <p className="text-xs mt-0.5 opacity-80">{cfg.label}</p>
                </div>
              );
            })}
            {dev.outcome_counts['pending'] > 0 && (
              <div className="rounded-xl border p-4 text-center bg-amber-50 text-amber-700">
                <p className="text-2xl font-bold tabular-nums">{dev.outcome_counts['pending']}</p>
                <p className="text-xs mt-0.5 opacity-80">Pending</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {dev.notes && (
            <section className="rounded-xl border p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground">{dev.notes}</p>
            </section>
          )}

          {/* Shared assets */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">
                Shared Assets
                {dev.share_count > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">· {dev.share_count} total</span>
                )}
              </h2>
              {dev.last_shared_at && (
                <p className="text-xs text-muted-foreground">Last shared {formatTimeAgo(dev.last_shared_at)}</p>
              )}
            </div>

            {dev.shares.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border border-dashed">
                <Building2 className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No assets shared with this developer yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dev.shares.map((s) => (
                  <ShareRow key={s.id} share={s} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
