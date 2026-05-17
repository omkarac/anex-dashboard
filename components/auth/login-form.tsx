'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

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

// ─── Admin modal ──────────────────────────────────────────────────────────────

function AdminLoginForm({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = (fd.get('email') as string).trim().toLowerCase();
    const password = fd.get('password') as string;

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    window.location.href = '/';
  }

  return (
    <div className={onClose ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm' : ''}>
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
            <Input
              id="admin-email"
              name="email"
              type="email"
              placeholder="admin@anexadvisory.com"
              required
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-sm font-medium">Password</Label>
            <Input
              id="admin-password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="h-10"
            />
          </div>

          <Button type="submit" className="w-full h-10 font-medium mt-2" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Main login form ──────────────────────────────────────────────────────────

interface Props {
  urlError?: string;
  /** Rendered inline (no overlay) when page was opened via secret admin link */
  showAdminForm?: boolean;
}

export function LoginForm({ urlError, showAdminForm }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError ?? null);

  async function handleMicrosoftSignIn() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile openid',
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // On success Supabase redirects — no further client action needed
  }

  // Secret admin link — render form inline, no overlay chrome
  if (showAdminForm) {
    return <AdminLoginForm />;
  }

  return (
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
  );
}
