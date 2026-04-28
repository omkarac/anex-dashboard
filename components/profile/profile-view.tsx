'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Mail, Phone, Calendar, Building2, CheckSquare, Zap, Pencil, Check, X, ExternalLink, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateProfile } from '@/lib/actions/profile';
import { formatDate } from '@/lib/utils/formatters';
import type { ProfileData, ProfileStats, ProfileAsset, ProfileTask } from '@/lib/queries/profile';

// ─── Palette (same logic as developers page) ─────────────────────────────────

const PALETTES = [
  { bg: 'bg-rose-100',    ring: 'ring-rose-200',    text: 'text-rose-700'    },
  { bg: 'bg-orange-100',  ring: 'ring-orange-200',  text: 'text-orange-700'  },
  { bg: 'bg-amber-100',   ring: 'ring-amber-200',   text: 'text-amber-700'   },
  { bg: 'bg-emerald-100', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  { bg: 'bg-cyan-100',    ring: 'ring-cyan-200',    text: 'text-cyan-700'    },
  { bg: 'bg-blue-100',    ring: 'ring-blue-200',    text: 'text-blue-700'    },
  { bg: 'bg-violet-100',  ring: 'ring-violet-200',  text: 'text-violet-700'  },
  { bg: 'bg-pink-100',    ring: 'ring-pink-200',    text: 'text-pink-700'    },
];

function palette(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
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

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({
  value, placeholder, onSave, className = '',
}: {
  value: string; placeholder: string; onSave: (v: string) => void; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function save() {
    onSave(draft.trim());
    setEditing(false);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          className={`h-7 text-sm ${className}`}
        />
        <button onClick={save} className="text-primary hover:opacity-70 transition-opacity"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={cancel} className="text-muted-foreground hover:opacity-70 transition-opacity"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`group flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity ${className}`}
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </button>
  );
}

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

// ─── Main view ────────────────────────────────────────────────────────────────

export function ProfileView({
  profile,
  stats,
  assets,
  tasks,
}: {
  profile: ProfileData;
  stats: ProfileStats;
  assets: ProfileAsset[];
  tasks: ProfileTask[];
}) {
  const p = palette(profile.full_name);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: profile.full_name,
    title: profile.title ?? '',
    phone: profile.phone ?? '',
  });

  function save(patch: Partial<typeof form>) {
    const next = { ...form, ...patch };
    setForm(next);
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({
        full_name: next.full_name || profile.full_name,
        title: next.title.trim() || null,
        phone: next.phone.trim() || null,
      });
      if (!result.ok) setError(result.error);
    });
  }

  const isOverdue = (due: string | null) => due && new Date(due) < new Date();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

      {/* ── Profile hero ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Top accent strip */}
        <div className={`h-24 ${p.bg} relative`}>
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
        </div>

        <div className="px-8 pb-8">
          {/* Avatar — overlaps the strip */}
          <div className="flex items-end justify-between -mt-10 mb-5">
            <div className={`h-20 w-20 rounded-2xl ${p.bg} ${p.text} ${p.ring} ring-4 ring-offset-2 ring-offset-background flex items-center justify-center text-2xl font-bold shadow-sm`}>
              {initials(form.full_name || profile.full_name)}
            </div>
            {/* Role badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${profile.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
              {profile.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {profile.role === 'admin' ? 'Admin' : 'Member'}
            </span>
          </div>

          {/* Name + title */}
          <div className="flex flex-col gap-1 mb-5">
            <EditableField
              value={form.full_name}
              placeholder="Your name"
              onSave={(v) => save({ full_name: v })}
              className="text-2xl font-bold"
            />
            <EditableField
              value={form.title}
              placeholder="Add a job title…"
              onSave={(v) => save({ title: v })}
              className="text-sm text-muted-foreground"
            />
          </div>

          {/* Contact row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {profile.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <EditableField
                value={form.phone}
                placeholder="Add phone…"
                onSave={(v) => save({ phone: v })}
                className="text-sm text-muted-foreground"
              />
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              Joined {formatDate(profile.created_at)}
            </span>
          </div>

          {error && <p className="text-xs text-destructive mt-3">{error}</p>}
          {isPending && <p className="text-xs text-muted-foreground mt-3">Saving…</p>}
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <StatCard icon={Building2} label="Assigned Assets" value={stats.assigned_assets} color="bg-blue-50 text-blue-600" />
        <StatCard icon={CheckSquare} label="Open Tasks" value={stats.open_tasks} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Zap} label="Actions This Month" value={stats.activity_this_month} color="bg-emerald-50 text-emerald-600" />
      </div>

      {/* ── Panels ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* My Assets */}
        <div className="rounded-xl border bg-card flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">My Assigned Assets</h2>
            <Link
              href={`/assets`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {assets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
              No assets assigned yet
            </div>
          ) : (
            <ul className="divide-y">
              {assets.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/assets/${a.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {a.property_name}
                      </p>
                      {a.location && (
                        <p className="text-xs text-muted-foreground truncate">{a.location}</p>
                      )}
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

        {/* My Tasks */}
        <div className="rounded-xl border bg-card flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">My Open Tasks</h2>
            <span className="text-xs text-muted-foreground">{stats.open_tasks} pending</span>
          </div>
          {tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
              No open tasks
            </div>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/assets/${t.asset_id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${PRIORITY_STYLES[t.priority] ?? 'text-muted-foreground'} bg-current`} title={t.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{t.asset_name}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {TASK_STATUS_LABELS[t.status] ?? t.status}
                      </span>
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
