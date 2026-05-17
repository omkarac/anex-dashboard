'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, ExternalLink, ChevronLeft, Building2, Pencil, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatDate, formatTimeAgo } from '@/lib/utils/formatters';
import { updateShareOutcome, updateDeveloper } from '@/lib/actions/developers';
import { AppetiteSection } from './appetite-section';
import { LocationSection } from './location-section';
import { ShareTasksUpdates } from './share-tasks-updates';
import type { DeveloperWithStats, DeveloperShareFull } from '@/lib/queries/developers';
import type { TeamMemberSelect } from '@/lib/queries/team';

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

const OUTCOME_CONFIG: Record<string, { label: string; badge: string; dot: string; tile: string }> = {
  interested: { label: 'Interested', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', tile: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  pursuing:   { label: 'Pursuing',   badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500',    tile: 'bg-blue-50 border-blue-200 text-blue-700'       },
  won:        { label: 'Won',        badge: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500',  tile: 'bg-purple-50 border-purple-200 text-purple-700' },
  passed:     { label: 'Passed',     badge: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400',    tile: 'bg-gray-50 border-gray-200 text-gray-500'       },
  pending:    { label: 'Pending',    badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',   tile: 'bg-amber-50 border-amber-200 text-amber-700'    },
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
      <div className={`${sz} flex items-center justify-center overflow-hidden border bg-white shrink-0 shadow-sm`}>
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
    <div className={`${sz} flex items-center justify-center font-bold shrink-0 shadow-sm ${p.bg} ${p.text}`}>
      {initials(name)}
    </div>
  );
}

function ContactField({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground mb-1.5">{label}</p>
      {value ? (
        href ? (
          <a
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary transition-colors truncate max-w-full"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{value}</span>
          </a>
        ) : label.toLowerCase() === 'phone' ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {value}
          </span>
        ) : (
          <p className="text-sm font-semibold">{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground/60">—</p>
      )}
    </div>
  );
}

function ShareRow({ share, members }: { share: DeveloperShareFull; members: TeamMemberSelect[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleOutcomeChange(outcome: string) {
    startTransition(async () => {
      await updateShareOutcome(share.id, share.asset_id, outcome);
      router.refresh();
    });
  }

  const openCount = share.tasks.filter((t) => t.status !== 'done').length;
  const totalCount = share.tasks.length;

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/capital-markets/assets/${share.asset_id}`}
            className="font-medium text-sm hover:underline underline-offset-2 flex items-center gap-1 group/link"
          >
            {share.asset_name}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-60 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-muted-foreground">
              Shared by {share.shared_by_name} · {formatDate(share.shared_at)}
            </p>
            {totalCount > 0 && (
              <span className="text-[10px] text-muted-foreground/60">
                {totalCount - openCount}/{totalCount} tasks done
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {share.outcome && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_CONFIG[share.outcome]?.badge ?? ''}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${OUTCOME_CONFIG[share.outcome]?.dot ?? ''}`} />
              {OUTCOME_CONFIG[share.outcome]?.label ?? share.outcome}
            </span>
          )}
          <select
            value={share.outcome ?? ''}
            disabled={isPending}
            onChange={(e) => handleOutcomeChange(e.target.value)}
            className="h-7 rounded-full border px-2.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
          >
            <option value="" disabled>Set outcome</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o} value={o}>{OUTCOME_CONFIG[o].label}</option>
            ))}
          </select>
        </div>
      </div>

      <ShareTasksUpdates
        shareId={share.id}
        tasks={share.tasks}
        updates={share.updates}
        members={members}
      />
    </div>
  );
}

export function DeveloperDetailView({ dev, members }: { dev: DeveloperWithStats; members: TeamMemberSelect[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: dev.name,
    contact_person: dev.contact_person ?? '',
    contact_email: dev.contact_email ?? '',
    contact_phone: dev.contact_phone ?? '',
    logo_url: dev.logo_url ?? '',
    notes: dev.notes ?? '',
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [absorbed, setAbsorbed] = useState(false);
  const [stripHeight, setStripHeight] = useState(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setAbsorbed(el.scrollTop > 48);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (stripRef.current) setStripHeight(stripRef.current.scrollHeight);
  }, [dev.contact_person, dev.contact_email, dev.contact_phone, dev.notes]);

  const p = palette(dev.name);
  const activeLogoUrl = editing ? (form.logo_url.trim() || null) : dev.logo_url;
  const dominantRgb = useDominantColor(activeLogoUrl);

  const outcomeEntries = Object.entries(dev.outcome_counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function cancelEdit() {
    setForm({
      name: dev.name,
      contact_person: dev.contact_person ?? '',
      contact_email: dev.contact_email ?? '',
      contact_phone: dev.contact_phone ?? '',
      logo_url: dev.logo_url ?? '',
      notes: dev.notes ?? '',
    });
    setEditing(false);
    setError(null);
  }

  function saveEdit() {
    const patch = {
      name: form.name.trim() || dev.name,
      contact_person: form.contact_person.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      logo_url: form.logo_url.trim() || null,
      notes: form.notes.trim() || null,
    };
    startTransition(async () => {
      const result = await updateDeveloper(dev.id, patch);
      if (result.ok) {
        setEditing(false);
        setError(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Hero ── */}
      <div className="relative border-b shrink-0 overflow-hidden">

        {/* Background layers */}
        {activeLogoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLogoUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
              style={{ filter: 'blur(32px) saturate(200%)', transform: 'scale(1.6)', opacity: 0.3 }}
            />
            <div className="absolute inset-0 bg-background/60" />
            {dominantRgb && (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, rgba(${dominantRgb},0.18) 0%, rgba(${dominantRgb},0.05) 100%)` }}
              />
            )}
          </>
        ) : (
          <div className={`absolute inset-0 opacity-30 ${p.bg}`} />
        )}

        {/* Foreground */}
        <div className="relative px-6 pt-4">

          {/* Nav + edit controls */}
          <div className="flex items-center justify-between mb-5">
            <Link
              href="/capital-markets/developers"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Developers
            </Link>
            <div className="flex items-center gap-1.5">
              {editing ? (
                <>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit} disabled={isPending}>
                    <X className="h-3.5 w-3.5 mr-1" />Cancel
                  </Button>
                  <Button size="sm" className="h-7 px-3" onClick={saveEdit} disabled={isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" />Save
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
              )}
            </div>
          </div>

          {/* Identity row */}
          <div className="flex items-center gap-4">
            <DeveloperAvatar
              name={editing ? (form.name || dev.name) : dev.name}
              logoUrl={activeLogoUrl}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              {editing ? (
                <Input
                  value={form.name}
                  onChange={field('name')}
                  className="h-9 text-lg font-bold bg-background/70 border-border/60 backdrop-blur-sm"
                  placeholder="Company name"
                />
              ) : (
                <h1 className="text-2xl font-bold tracking-tight leading-tight">{dev.name}</h1>
              )}
            </div>

            {/* Compact contact — slides in from right on scroll, view mode only */}
            {!editing && (dev.contact_person || dev.contact_email || dev.contact_phone) && (
              <div
                className="shrink-0 flex flex-col items-end gap-1.5 text-right max-w-[260px]"
                style={{
                  opacity: absorbed ? 1 : 0,
                  transform: absorbed ? 'translateX(0)' : 'translateX(16px)',
                  transition: 'opacity 0.35s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1)',
                  pointerEvents: absorbed ? 'auto' : 'none',
                }}
              >
                {dev.contact_person && (
                  <p className="text-sm font-semibold leading-none truncate">{dev.contact_person}</p>
                )}
                <div className="flex items-center gap-3">
                  {dev.contact_email && (
                    <a
                      href={`mailto:${dev.contact_email}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[160px]"
                    >
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{dev.contact_email}</span>
                    </a>
                  )}
                  {dev.contact_phone && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Phone className="h-3 w-3 shrink-0" />
                      {dev.contact_phone}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Edit form — replaces contact strip when editing */}
          {editing && (
            <div className="mt-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    { key: 'contact_person' as const, label: 'Contact Person', type: 'text',  placeholder: 'Full name' },
                    { key: 'contact_email'  as const, label: 'Email',          type: 'email', placeholder: 'email@company.com' },
                    { key: 'contact_phone'  as const, label: 'Phone',          type: 'text',  placeholder: '+91 98…' },
                    { key: 'logo_url'       as const, label: 'Logo URL',       type: 'url',   placeholder: 'https://company.com/logo.png' },
                  ] as const
                ).map(({ key, label, type, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">{label}</Label>
                    <Input
                      value={form[key]}
                      onChange={field(key)}
                      type={type}
                      placeholder={placeholder}
                      className="h-8 text-sm bg-background/70 border-border/60 backdrop-blur-sm"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <Label className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={field('notes')}
                    placeholder="Any relevant context…"
                    className="text-sm resize-none min-h-[64px] bg-background/70 border-border/60 backdrop-blur-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contact strip — collapses and migrates right on scroll */}
          {!editing && (
            <div
              className="overflow-hidden"
              style={{
                height: absorbed ? 0 : stripHeight || 'auto',
                opacity: absorbed ? 0 : 1,
                transition: 'height 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
              }}
            >
              <div ref={stripRef} className="mt-5 border-t border-border/40 pt-4 pb-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <ContactField label="Contact" value={dev.contact_person} />
                  <ContactField
                    label="Email"
                    value={dev.contact_email}
                    href={dev.contact_email ? `mailto:${dev.contact_email}` : undefined}
                  />
                  <ContactField label="Phone" value={dev.contact_phone} />
                </div>
                {dev.notes && (
                  <p className="mt-4 text-xs text-muted-foreground border-t border-border/30 pt-3 leading-relaxed">
                    {dev.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && <p className="relative text-xs text-destructive pb-3 -mt-1">{error}</p>}
        </div>

        {/* Compact KPI strip — slides into hero bottom as user scrolls */}
        <div
          className="overflow-hidden"
          style={{
            height: absorbed ? '42px' : '0px',
            transition: 'height 0.45s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div
            className="border-t border-border/40 px-6 flex items-center gap-0"
            style={{
              transform: absorbed ? 'translateY(0)' : 'translateY(-100%)',
              transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1)',
              height: '42px',
            }}
          >
            {[
              { label: 'Shared', value: dev.share_count, dot: '' },
              ...outcomeEntries.map(([o, n]) => ({
                label: OUTCOME_CONFIG[o]?.label ?? o,
                value: n,
                dot: OUTCOME_CONFIG[o]?.dot ?? '',
              })),
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <span className="mx-4 text-border select-none">·</span>}
                <span className="inline-flex items-center gap-2">
                  {stat.dot && (
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stat.dot}`} />
                  )}
                  <span className="text-sm font-bold tabular-nums">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div ref={contentRef} className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">

          {/* KPI tiles — fade out once absorbed into hero strip */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            style={{
              opacity: absorbed ? 0 : 1,
              transition: 'opacity 0.3s ease',
              pointerEvents: absorbed ? 'none' : 'auto',
            }}
          >
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2">Assets Shared</p>
              <p className="text-2xl font-bold tabular-nums">{dev.share_count}</p>
            </div>
            {outcomeEntries.map(([outcome, count]) => {
              const cfg = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.pending;
              return (
                <div key={outcome} className={`rounded-xl border p-4 ${cfg.tile}`}>
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2 opacity-70">{cfg.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                </div>
              );
            })}
          </div>

          {/* Deal Geography — independent of appetite, shows actual shared/interested asset locations */}
          {!editing && (
            <LocationSection
              sharedMarkets={dev.sharedMarkets}
              interestedMarkets={dev.interestedMarkets}
              appetiteMarkets={dev.preferences?.preferred_micro_markets}
            />
          )}

          {/* Investment Appetite */}
          {!editing && (
            <AppetiteSection
              developerId={dev.id}
              preferences={dev.preferences}
            />
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
                  <ShareRow key={s.id} share={s} members={members} />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
