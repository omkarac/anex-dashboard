'use client';

import { useState, useEffect } from 'react';
import { X, Zap, ChevronRight, Sun, Moon } from 'lucide-react';

/* ── CSS: glow vars + keyframes ─────────────────────────────────────────────
   Light → brand navy  (#1220B3 = rgb 18,32,179)
   Dark  → brand blue  (#4862E8 = rgb 72,98,232)
   Both reference the same keyframe — only the vars change per theme.
*/
const STYLES = `
  :root {
    --gw1: rgba(18,32,179,0.18);
    --gw2: rgba(18,32,179,0.50);
    --gh1: rgba(18,32,179,0.07);
    --gh2: rgba(18,32,179,0.17);
    --cs:  0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(18,32,179,0.05);
    --csh: 0 2px 10px rgba(18,32,179,0.10), 0 14px 32px rgba(0,0,0,0.06);
  }
  .dark {
    --gw1: rgba(72,98,232,0.26);
    --gw2: rgba(72,98,232,0.60);
    --gh1: rgba(72,98,232,0.11);
    --gh2: rgba(72,98,232,0.26);
    --cs:  0 1px 0 rgba(255,255,255,0.055) inset, 0 2px 8px rgba(0,0,0,0.42);
    --csh: 0 1px 0 rgba(255,255,255,0.09) inset, 0 8px 28px rgba(0,0,0,0.58);
  }
  @keyframes breathe {
    0%,100% { box-shadow: 0 0 0 1.5px var(--gw1), 0 0 16px 4px var(--gh1), var(--cs); }
    50%     { box-shadow: 0 0 0 2.5px var(--gw2), 0 0 28px 8px var(--gh2), var(--cs); }
  }
  @keyframes fab-ring {
    0%   { transform: scale(1);   opacity: 0.55; }
    100% { transform: scale(2.7); opacity: 0;    }
  }
  @keyframes slide-up {
    from { transform: translateY(16px) scale(0.97); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
  }
  @keyframes badge-pop {
    0%  { transform: scale(0.3); opacity: 0; }
    70% { transform: scale(1.18); }
    100%{ transform: scale(1);   opacity: 1; }
  }
  .card-base    { box-shadow: var(--cs); transition: box-shadow 0.25s ease, transform 0.2s ease; }
  .card-base:hover { box-shadow: var(--csh); transform: translateY(-2px); }
  .card-urgent  { animation: breathe 2.5s ease-in-out infinite; }
  .card-urgent:hover { animation-play-state: paused; box-shadow: var(--csh); transform: translateY(-2px); }
  .task-expand  { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.3s ease, opacity 0.2s ease; }
  .card-urgent:hover .task-expand,
  .card-base:hover   .task-expand { max-height: 140px; opacity: 1; }
  .fab-ring  { animation: fab-ring 2.2s ease-out infinite; }
  .drawer    { animation: slide-up 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
  .bdg       { animation: badge-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
`;

/* ── Mock data ──────────────────────────────────────────────────────────────── */

type UrgentTask = { task: string; asset: string };

type Dev = {
  id: string;
  name: string;
  initials: string;
  contact: string;
  role: string;
  shares: number;
  unassigned: UrgentTask[];
  strip: string;
  avatarGrad: string;
  outcomes: { label: string; n: number; cls: string }[];
  since: string;
};

const DEVS: Dev[] = [
  {
    id: 'lodha',
    name: 'Lodha Group',
    initials: 'LG',
    contact: 'Rajesh Mehta',
    role: 'VP – Acquisitions',
    shares: 4,
    unassigned: [
      { task: 'Share IM', asset: 'Worli Plot' },
      { task: 'Share FF', asset: 'Worli Plot' },
    ],
    strip: 'linear-gradient(90deg,#2563eb,#60a5fa)',
    avatarGrad: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    outcomes: [
      { label: 'Interested', n: 2, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/50' },
      { label: 'Pursuing',   n: 1, cls: 'bg-blue-50 text-blue-700 border border-blue-200/70 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/50' },
    ],
    since: 'Mar 2024',
  },
  {
    id: 'godrej',
    name: 'Godrej Properties',
    initials: 'GP',
    contact: 'Priya Sharma',
    role: 'Head – Strategic Investments',
    shares: 3,
    unassigned: [{ task: 'Secure EOI', asset: 'BKC Tower' }],
    strip: 'linear-gradient(90deg,#059669,#34d399)',
    avatarGrad: 'linear-gradient(135deg,#047857,#10b981)',
    outcomes: [
      { label: 'Pursuing', n: 2, cls: 'bg-blue-50 text-blue-700 border border-blue-200/70 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/50' },
    ],
    since: 'Jan 2024',
  },
  {
    id: 'rustomjee',
    name: 'Rustomjee Group',
    initials: 'RG',
    contact: 'Anil Kapoor',
    role: 'Director – Land Acquisitions',
    shares: 2,
    unassigned: [
      { task: 'Share IM',   asset: 'Andheri West' },
      { task: 'Secure EOI', asset: 'Andheri West' },
    ],
    strip: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
    avatarGrad: 'linear-gradient(135deg,#6d28d9,#8b5cf6)',
    outcomes: [
      { label: 'Interested', n: 1, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/50' },
    ],
    since: 'Apr 2024',
  },
  {
    id: 'piramal',
    name: 'Piramal Realty',
    initials: 'PR',
    contact: 'Sunita Joshi',
    role: 'MD – Investment & Development',
    shares: 5,
    unassigned: [],
    strip: 'linear-gradient(90deg,#be123c,#f43f5e)',
    avatarGrad: 'linear-gradient(135deg,#9f1239,#e11d48)',
    outcomes: [
      { label: 'Won',      n: 1, cls: 'bg-violet-50 text-violet-700 border border-violet-200/70 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800/50' },
      { label: 'Pursuing', n: 2, cls: 'bg-blue-50 text-blue-700 border border-blue-200/70 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/50' },
    ],
    since: 'Nov 2023',
  },
];

const URGENT = DEVS
  .filter((d) => d.unassigned.length > 0)
  .flatMap((d) => d.unassigned.map((t) => ({ ...t, devName: d.name, devId: d.id, strip: d.strip })));

/* ── Developer card ─────────────────────────────────────────────────────────── */

function DevCard({ dev }: { dev: Dev }) {
  const urgent = dev.unassigned.length > 0;
  return (
    <div className={`relative rounded-2xl border border-border bg-card overflow-hidden ${urgent ? 'card-urgent' : 'card-base'}`}>
      {/* Top colour strip */}
      <div className="h-[3px]" style={{ background: dev.strip }} />

      {/* Urgent badge */}
      {urgent && (
        <div className="bdg absolute top-3.5 right-3.5 z-10">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/25 text-[9px] font-semibold tracking-wide px-2 py-0.5">
            {dev.unassigned.length} unassigned
          </span>
        </div>
      )}

      <div className="relative p-4 flex flex-col gap-3.5">
        {/* Dark-mode depth overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.025] to-transparent pointer-events-none hidden dark:block" />

        {/* Identity */}
        <div className="flex items-start gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            style={{ background: dev.avatarGrad }}
          >
            {dev.initials}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-semibold text-sm leading-tight tracking-tight truncate">{dev.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{dev.contact}</p>
            <p className="text-[10px] text-muted-foreground/55 mt-0.5 truncate">{dev.role}</p>
          </div>
        </div>

        {/* Outcome tags */}
        <div className="flex flex-wrap gap-1.5">
          {dev.outcomes.map((o) => (
            <span key={o.label} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${o.cls}`}>
              {o.n} {o.label}
            </span>
          ))}
        </div>

        {/* Task list — expands on hover via CSS */}
        {urgent && (
          <div className="task-expand">
            <div className="border-t border-primary/15 pt-2.5 flex flex-col gap-1.5">
              {dev.unassigned.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                  <span className="font-medium text-foreground/80">{t.task}</span>
                  <span className="text-muted-foreground/50 text-[10px] ml-auto">{t.asset}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2.5">
          <span className="font-medium">{dev.shares} assets shared</span>
          <span className="opacity-55">Since {dev.since}</span>
        </div>
      </div>
    </div>
  );
}

/* ── FAB + action drawer ──────────────────────────────────────────────────────── */

function ActionFAB() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
      {/* Drawer */}
      {open && (
        <div className="drawer w-80 rounded-2xl border border-border bg-card/95 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50">
          {/* Drawer header */}
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-primary mb-1">Needs Action</p>
                <p className="text-sm font-semibold tracking-tight">{URGENT.length} unassigned tasks</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors -mt-0.5"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Urgent rows */}
          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {URGENT.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group/row">
                <div className="h-5 w-[3px] rounded-full shrink-0" style={{ background: item.strip }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.devName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.task} · {item.asset}</p>
                </div>
                <button className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-primary opacity-60 group-hover/row:opacity-100 transition-opacity">
                  Assign <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB button */}
      <div className="relative">
        {!open && <span className="fab-ring absolute inset-0 rounded-full bg-primary" />}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label={open ? 'Close action tray' : `${URGENT.length} urgent items`}
        >
          <span className="transition-transform duration-300" style={{ transform: open ? 'rotate(135deg)' : 'rotate(0deg)' }}>
            {open ? <X className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </span>
        </button>
        {!open && (
          <span className="bdg absolute -top-1.5 -right-1.5 h-5 min-w-[20px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-1 shadow border-2 border-background">
            {URGENT.length}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────────── */

export default function UIDemoPage() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleDark() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{STYLES}</style>

      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-tight text-foreground">Anex</span>
            <span className="h-3.5 w-px bg-border" />
            <span className="text-xs text-muted-foreground">Developer Cards · Urgent Task Indicators</span>
            <span className="text-[9px] border border-border rounded-full px-2 py-0.5 text-muted-foreground/70 uppercase tracking-wider font-medium hidden sm:inline">
              UI Preview
            </span>
          </div>
          <button
            onClick={toggleDark}
            className="h-8 w-8 rounded-lg border border-border hover:bg-muted/60 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      {/* Page header */}
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-8">
        <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-primary mb-2">Design Preview</p>
        <h1 className="text-2xl font-semibold tracking-tight">Urgent Task Indicators</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
          Unassigned routine tasks surface via a breathing accent ring on each developer card,
          and are aggregated in the action tray for quick assignment.
          Both signals work together — the ring gives ambient awareness, the FAB enables bulk action.
        </p>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-primary/35 bg-primary/5" />
            <span>Breathing ring = has unassigned tasks · hover to reveal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center">
              <Zap className="h-2 w-2 text-primary-foreground" />
            </span>
            <span>FAB = aggregate action tray</span>
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="max-w-4xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {DEVS.map((d) => <DevCard key={d.id} dev={d} />)}
        </div>
      </div>

      {/* FAB — fixed viewport */}
      <ActionFAB />
    </div>
  );
}
