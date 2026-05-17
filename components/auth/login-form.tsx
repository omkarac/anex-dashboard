'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const BROKEN_ANGLE    = 32;   // degrees the logo tilts to after "screw removed"
const SNAP_THRESHOLD  = 8;    // degrees from 0° that counts as recalibrated
const CLICKS_TO_BREAK = 5;

// ─── Microsoft icon ───────────────────────────────────────────────────────────

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

// ─── Easter egg logo ──────────────────────────────────────────────────────────
//
// Phase machine:
//   idle     → click 5× → broken (wobble animation plays)
//   broken   → pointerdown → dragging (user rotates logo back)
//   dragging → within ±8° of 0 → snapped (spring to straight) → onUnlock()
//   dragging → pointerup without snap → back to broken (falls back to tilt)

type Phase = 'idle' | 'broken' | 'dragging' | 'snapped';

function EasterEggLogo({ onUnlock }: { onUnlock: () => void }) {
  const [clicks,   setClicks]   = useState(0);
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [rotation, setRotation] = useState(0);

  const logoRef  = useRef<HTMLDivElement>(null);
  const dragData = useRef<{ startAngle: number; startRotation: number } | null>(null);
  const isDragging = useRef(false);

  // When broken → drift back upright slowly if the user never grabs it
  // (purely aesthetic — gentle reminder that something is wrong)
  useEffect(() => {
    if (phase !== 'broken') return;
    // Nothing needed; CSS animation handles the wobble
  }, [phase]);

  function getAngleFromCenter(x: number, y: number): number {
    if (!logoRef.current) return 0;
    const r  = logoRef.current.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
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
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragData.current = {
      startAngle:    getAngleFromCenter(e.clientX, e.clientY),
      startRotation: BROKEN_ANGLE, // start from where the wobble roughly sits
    };
    setPhase('dragging');
    setRotation(BROKEN_ANGLE);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (phase !== 'dragging' || !dragData.current) return;

    const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
    const delta        = currentAngle - dragData.current.startAngle;
    const newRot       = dragData.current.startRotation + delta;
    setRotation(newRot);

    // Normalize to [0, 360) and check proximity to 0°
    const norm    = ((newRot % 360) + 360) % 360;
    const nearZero = norm < SNAP_THRESHOLD || norm > 360 - SNAP_THRESHOLD;

    if (nearZero) {
      dragData.current   = null;
      isDragging.current = false;
      setPhase('snapped');
      setRotation(0);
      setTimeout(onUnlock, 750); // let the spring animation finish
    }
  }

  function handlePointerUp() {
    if (phase !== 'dragging') return;
    isDragging.current = false;
    dragData.current   = null;
    // Not snapped — fall back to broken wobble
    setPhase('broken');
    setRotation(BROKEN_ANGLE);
  }

  // ── Style computation ────────────────────────────────────────────────────
  const style: React.CSSProperties = (() => {
    switch (phase) {
      case 'idle':
        return {};

      case 'broken':
        // CSS @keyframes animation controls transform — do NOT set inline transform
        return {
          animation:  'logo-wobble 2.8s ease-in-out infinite',
          filter:     'drop-shadow(0 3px 10px rgba(0,0,0,0.22))',
          cursor:     'grab',
        };

      case 'dragging':
        return {
          transform:  `rotate(${rotation}deg)`,
          filter:     'drop-shadow(0 3px 10px rgba(0,0,0,0.22))',
          cursor:     'grabbing',
          transition: 'none',
        };

      case 'snapped':
        return {
          transform:  'rotate(0deg)',
          transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter:     'drop-shadow(0 0 12px rgba(99,102,241,0.5))',
        };
    }
  })();

  return (
    <div
      ref={logoRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative select-none touch-none"
      style={style}
      aria-hidden="true"
    >
      <Image
        src="/logo-dark.png"
        alt="Anex"
        width={64}
        height={64}
        className="object-contain dark:hidden"
        priority
        draggable={false}
      />
      <Image
        src="/logo-white.png"
        alt="Anex"
        width={64}
        height={64}
        className="object-contain hidden dark:block"
        priority
        draggable={false}
      />
    </div>
  );
}

// ─── Admin modal ──────────────────────────────────────────────────────────────

function AdminLoginForm({ inline, onClose }: { inline?: boolean; onClose?: () => void }) {
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

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    window.location.href = '/';
  }

  const inner = (
    <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-2xl p-8">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}

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
  );

  if (inline) return inner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {inner}
    </div>
  );
}

// ─── Main login form ──────────────────────────────────────────────────────────

interface Props {
  urlError?: string;
  showAdminForm?: boolean;
}

export function LoginForm({ urlError, showAdminForm }: Props) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(urlError ?? null);
  const [adminOpen,  setAdminOpen]  = useState(false);

  async function handleMicrosoftSignIn() {
    setError(null);
    setLoading(true);
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:     'email profile openid',
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  // Secret URL — render admin form inline, no overlay
  if (showAdminForm) return <AdminLoginForm inline />;

  return (
    <>
      {/* Easter egg admin modal */}
      {adminOpen && <AdminLoginForm onClose={() => setAdminOpen(false)} />}

      {/* Logo — easter egg trigger */}
      <div className="flex justify-center mb-8">
        <EasterEggLogo onUnlock={() => setAdminOpen(true)} />
      </div>

      <div className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
            {error === 'domain_not_allowed'
              ? 'Access restricted to @anexadvisory.com accounts.'
              : error === 'deactivated'
                ? 'Your account has been deactivated. Contact your administrator.'
                : error === 'exchange_failed'
                  ? 'Sign-in failed. Please try again.'
                  : error}
          </div>
        )}

        <Button
          onClick={handleMicrosoftSignIn}
          disabled={loading}
          variant="outline"
          className="w-full h-11 font-medium flex items-center gap-3 border-border hover:bg-muted/60 transition-colors"
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          ) : (
            <MicrosoftIcon />
          )}
          {loading ? 'Redirecting…' : 'Sign in with Microsoft'}
        </Button>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Access restricted to{' '}
          <span className="font-medium text-foreground">@anexadvisory.com</span> accounts.
        </p>
      </div>
    </>
  );
}
