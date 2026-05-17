'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

const BROKEN_ANGLE   = 32;
const SNAP_THRESHOLD = 8;
const CLICKS_TO_BREAK = 5;

type Phase = 'idle' | 'broken' | 'dragging' | 'snapped';

// ─── Admin modal (fixed overlay — escapes any parent container) ───────────────

function AdminLoginForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd       = new FormData(e.currentTarget);
    const email    = (fd.get('email')    as string).trim().toLowerCase();
    const password =  fd.get('password') as string;

    setLoading(true);
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    window.location.href = '/';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Admin access</h2>
          <p className="mt-1 text-xs text-muted-foreground">Sign in with your administrator credentials.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-sm font-medium">Email</Label>
            <Input id="admin-email" name="email" type="email"
              placeholder="admin@anexadvisory.com" required autoFocus className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-sm font-medium">Password</Label>
            <Input id="admin-password" name="password" type="password"
              placeholder="••••••••" required className="h-10" />
          </div>
          <Button type="submit" className="w-full h-10 font-medium mt-2" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Interactive logo — easter egg trigger ────────────────────────────────────

export function LoginLogoTrigger() {
  const [clicks,     setClicks]     = useState(0);
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [rotation,   setRotation]   = useState(0);
  const [adminOpen,  setAdminOpen]  = useState(false);

  const logoRef  = useRef<HTMLDivElement>(null);
  const dragData = useRef<{ startAngle: number; startRotation: number } | null>(null);

  function getAngleFromCenter(x: number, y: number): number {
    if (!logoRef.current) return 0;
    const r = logoRef.current.getBoundingClientRect();
    return Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * (180 / Math.PI);
  }

  function handleClick() {
    if (phase !== 'idle') return;
    const next = clicks + 1;
    setClicks(next);
    if (next >= CLICKS_TO_BREAK) {
      setPhase('broken');
      setRotation(BROKEN_ANGLE);
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (phase !== 'broken') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragData.current = {
      startAngle:    getAngleFromCenter(e.clientX, e.clientY),
      startRotation: BROKEN_ANGLE,
    };
    setPhase('dragging');
    setRotation(BROKEN_ANGLE);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (phase !== 'dragging' || !dragData.current) return;
    const delta  = getAngleFromCenter(e.clientX, e.clientY) - dragData.current.startAngle;
    const newRot = dragData.current.startRotation + delta;
    setRotation(newRot);

    const norm = ((newRot % 360) + 360) % 360;
    if (norm < SNAP_THRESHOLD || norm > 360 - SNAP_THRESHOLD) {
      dragData.current = null;
      setPhase('snapped');
      setRotation(0);
      setTimeout(() => setAdminOpen(true), 700);
    }
  }

  function handlePointerUp() {
    if (phase !== 'dragging') return;
    dragData.current = null;
    setPhase('broken');
    setRotation(BROKEN_ANGLE);
  }

  const style: React.CSSProperties = (() => {
    switch (phase) {
      case 'idle':    return {};
      case 'broken':  return {
        animation: 'logo-wobble 2.8s ease-in-out infinite',
        filter:    'drop-shadow(0 4px 16px rgba(0,0,0,0.35))',
        cursor:    'grab',
      };
      case 'dragging': return {
        transform:  `rotate(${rotation}deg)`,
        filter:     'drop-shadow(0 4px 16px rgba(0,0,0,0.35))',
        cursor:     'grabbing',
        transition: 'none',
      };
      case 'snapped': return {
        transform:  'rotate(0deg)',
        transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
        filter:     'drop-shadow(0 0 20px rgba(255,255,255,0.4))',
      };
    }
  })();

  return (
    <>
      {adminOpen && <AdminLoginForm onClose={() => { setAdminOpen(false); setPhase('idle'); setClicks(0); }} />}

      <div
        ref={logoRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="select-none touch-none"
        style={style}
        aria-hidden="true"
      >
        <Image
          src="/logo-white.png"
          alt="Anex"
          width={120}
          height={120}
          className="object-contain"
          priority
          draggable={false}
        />
      </div>
    </>
  );
}
