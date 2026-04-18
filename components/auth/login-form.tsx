'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { Mail, X } from 'lucide-react';

const ALLOWED_DOMAIN = '@anexadvisory.com';
const ADMIN_CLICKS_REQUIRED = 5;

function AdminLoginForm({ onClose }: { onClose: () => void }) {
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
            <Input
              id="admin-email"
              name="email"
              type="email"
              placeholder="admin@example.com"
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

export function LoginForm({ urlError, sent }: { urlError?: string; sent?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError ?? null);
  const [emailSent, setEmailSent] = useState(sent ?? false);
  const [sentTo, setSentTo] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminClicks, setAdminClicks] = useState(0);

  function handleVersionClick() {
    const next = adminClicks + 1;
    setAdminClicks(next);
    if (next >= ADMIN_CLICKS_REQUIRED) {
      setAdminOpen(true);
      setAdminClicks(0);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = (fd.get('email') as string).trim().toLowerCase();

    if (!email.endsWith(ALLOWED_DOMAIN)) {
      setError(`Only ${ALLOWED_DOMAIN} emails are allowed.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSentTo(email);
    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <p className="font-medium text-sm">Check your email</p>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>
          </p>
        </div>
        <button
          onClick={() => { setEmailSent(false); setSentTo(''); }}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      {adminOpen && <AdminLoginForm onClose={() => setAdminOpen(false)} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={`you${ALLOWED_DOMAIN}`}
            required
            autoFocus
            className="h-10"
          />
        </div>

        <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
          {loading ? 'Sending link…' : 'Send sign-in link'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          You'll receive a magic link — no password needed.
        </p>

        <p className="text-center">
          <button
            type="button"
            onClick={handleVersionClick}
            className="text-[10px] text-muted-foreground/20 hover:text-muted-foreground/20 select-none cursor-default"
            tabIndex={-1}
            aria-hidden="true"
          >
            v1
          </button>
        </p>
      </form>
    </>
  );
}
