'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Mail, Phone, Calendar, Building2, CheckSquare, Zap,
  ExternalLink, Shield, User, Pencil, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from '@/lib/actions/profile';
import { formatDate } from '@/lib/utils/formatters';
import type { ProfileData, ProfileStats, ProfileAsset, ProfileTask } from '@/lib/queries/profile';

// ─── Palettes ────────────────────────────────────────────────────────────────

const PALETTES = [
  { key: 'rose',    bg: 'bg-rose-100',    ring: 'ring-rose-200',    text: 'text-rose-700'    },
  { key: 'orange',  bg: 'bg-orange-100',  ring: 'ring-orange-200',  text: 'text-orange-700'  },
  { key: 'amber',   bg: 'bg-amber-100',   ring: 'ring-amber-200',   text: 'text-amber-700'   },
  { key: 'emerald', bg: 'bg-emerald-100', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  { key: 'cyan',    bg: 'bg-cyan-100',    ring: 'ring-cyan-200',    text: 'text-cyan-700'    },
  { key: 'blue',    bg: 'bg-blue-100',    ring: 'ring-blue-200',    text: 'text-blue-700'    },
  { key: 'violet',  bg: 'bg-violet-100',  ring: 'ring-violet-200',  text: 'text-violet-700'  },
  { key: 'pink',    bg: 'bg-pink-100',    ring: 'ring-pink-200',    text: 'text-pink-700'    },
];

function paletteFromName(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

function paletteFromKey(key: string | null) {
  return PALETTES.find((p) => p.key === key) ?? null;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  initial_assessment: 'bg-blue-100 text-blue-700',
  evaluating: 'bg-indigo-100 text-indigo-700',
  evaluated: 'bg-violet-100 text-violet-700',
  shared_with_developer: 'bg-amber-100 text-amber-700',
  on_hold: 'bg-gray-100 text-gray-500',
  won: 'bg-emerald-100 text-emerald-700',
  dropped: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New', initial_assessment: 'Initial Assessment', evaluating: 'Evaluating',
  evaluated: 'Evaluated', shared_with_developer: 'Shared', on_hold: 'On Hold',
  won: 'Won', dropped: 'Dropped',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-slate-400', medium: 'text-amber-500', high: 'text-rose-500',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex-1 rounded-xl border bg-card p-4 flex items-center gap-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

function EditPanel({
  draft, onChange, onSave, onCancel, isPending, error,
}: {
  draft: { full_name: string; title: string; phone: string; avatar_url: string; banner_color: string };
  onChange: (patch: Partial<typeof draft>) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="border rounded-xl bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Edit Profile</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ep-name" className="text-xs">Full Name</Label>
          <Input id="ep-name" value={draft.full_name} onChange={(e) => onChange({ full_name: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ep-title" className="text-xs">Job Title</Label>
          <Input id="ep-title" placeholder="e.g. Senior Analyst" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ep-phone" className="text-xs">Phone</Label>
          <Input id="ep-phone" placeholder="+1 555 000 0000" value={draft.phone} onChange={(e) => onChange({ phone: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ep-avatar" className="text-xs">Avatar Image URL</Label>
          <Input id="ep-avatar" placeholder="https://…" value={draft.avatar_url} onChange={(e) => onChange({ avatar_url: e.target.value })} className="h-8 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Banner &amp; Avatar Color</Label>
        <div className="flex gap-2 flex-wrap">
          {PALETTES.map((p) => (
            <button
              key={p.key}
              title={p.key}
              onClick={() => onChange({ banner_color: p.key })}
              className={`h-7 w-7 rounded-full border-2 transition-all ${p.bg} ${draft.banner_color === p.key ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105 hover:border-muted-foreground/40'}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ProfileView({
  profile, stats, assets, tasks,
}: {
  profile: ProfileData;
  stats: ProfileStats;
  assets: ProfileAsset[];
  tasks: ProfileTask[];
}) {
  const namePalette = paletteFromName(profile.full_name);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [saved, setSaved] = useState({
    full_name: profile.full_name,
    title: profile.title ?? '',
    phone: profile.phone ?? '',
    avatar_url: profile.avatar_url ?? '',
    banner_color: profile.banner_color ?? namePalette.key,
  });
  const [draft, setDraft] = useState(saved);

  useEffect(() => { setDraft(saved); }, [editing]); // reset draft when opening

  const activePalette = paletteFromKey(saved.banner_color) ?? namePalette;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({
        full_name: draft.full_name.trim() || profile.full_name,
        title: draft.title.trim() || null,
        phone: draft.phone.trim() || null,
        avatar_url: draft.avatar_url.trim() || null,
        banner_color: draft.banner_color,
      });
      if (result.ok) {
        setSaved(draft);
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  const isOverdue = (due: string | null) => due && new Date(due) < new Date();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

      {/* ── Profile hero ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card">
        {/* Banner — overflow-hidden only on the dot-pattern overlay */}
        <div className={`relative h-24 rounded-t-2xl ${activePalette.bg}`}>
          <div
            className="absolute inset-0 rounded-t-2xl overflow-hidden opacity-20 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
        </div>

        <div className="px-8 pb-8">
          <div className="flex items-end justify-between -mt-10 mb-5">
            {/* Avatar */}
            <div className={`h-20 w-20 rounded-2xl ${activePalette.bg} ${activePalette.text} ${activePalette.ring} ring-4 ring-offset-2 ring-offset-background flex items-center justify-center text-2xl font-bold shadow-sm relative overflow-hidden`}>
              {saved.avatar_url ? (
                <Image src={saved.avatar_url} alt={saved.full_name} fill className="object-cover" unoptimized />
              ) : (
                initials(saved.full_name || profile.full_name)
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${profile.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                {profile.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {profile.role === 'admin' ? 'Admin' : 'Member'}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setEditing((v) => !v)}>
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1 mb-5">
            <p className="text-2xl font-bold">{saved.full_name}</p>
            {saved.title && <p className="text-sm text-muted-foreground">{saved.title}</p>}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" />{profile.email}</span>
            {saved.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{saved.phone}</span>}
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 shrink-0" />Joined {formatDate(profile.created_at)}</span>
          </div>
        </div>
      </div>

      {/* ── Edit panel ─────────────────────────────────────────────────── */}
      {editing && (
        <EditPanel
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          isPending={isPending}
          error={error}
        />
      )}

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <StatCard icon={Building2} label="Assigned Assets" value={stats.assigned_assets} color="bg-blue-50 text-blue-600" />
        <StatCard icon={CheckSquare} label="Open Tasks" value={stats.open_tasks} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Zap} label="Actions This Month" value={stats.activity_this_month} color="bg-emerald-50 text-emerald-600" />
      </div>

      {/* ── Panels ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="rounded-xl border bg-card flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">My Assigned Assets</h2>
            <Link href="/capital-markets/assets" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {assets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">No assets assigned yet</div>
          ) : (
            <ul className="divide-y">
              {assets.map((a) => (
                <li key={a.id}>
                  <Link href={`/capital-markets/assets/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.property_name}</p>
                      {a.location && <p className="text-xs text-muted-foreground truncate">{a.location}</p>}
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">My Open Tasks</h2>
            <span className="text-xs text-muted-foreground">{stats.open_tasks} pending</span>
          </div>
          {tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">No open tasks</div>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/capital-markets/assets/${t.asset_id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group">
                    <div className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${PRIORITY_STYLES[t.priority] ?? 'text-muted-foreground'} bg-current`} title={t.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.asset_name}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">{TASK_STATUS_LABELS[t.status] ?? t.status}</span>
                      {t.due_date && (
                        <span className={`text-xs font-medium ${isOverdue(t.due_date) ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isOverdue(t.due_date) ? 'Overdue · ' : ''}{formatDate(t.due_date)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
