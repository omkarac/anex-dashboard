'use client';

import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// ─── ISOLATED AZURE SSO TEST PAGE ────────────────────────────────────────────
// Visit /auth-test to validate the Microsoft OAuth flow without touching the
// existing magic-link login. Delete this file once the switch is made.
// ─────────────────────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
    no_code: 'Sign-in was cancelled or timed out.',
    exchange_failed: 'Token exchange failed — check Azure/Supabase config.',
    no_user: 'No user returned after sign-in.',
    unauthorized_domain:
          'Only @anexadvisory.com accounts are permitted.',
    deactivated: 'This account has been deactivated.',
};

function SignInContent() {
    const params = useSearchParams();
    const errorKey = params.get('error');
    const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? 'An unexpected error occurred.') : null;

  const handleSignIn = async () => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                          scopes: 'email profile openid',
                          redirectTo: `${window.location.origin}/auth-test/callback`,
                },
        });
  };

  return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-8">
              <div className="w-full max-w-sm flex flex-col items-center gap-6 border border-border rounded-xl p-8 shadow-sm">
                {/* Header */}
                      <div className="text-center">
                                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Test Environment</p>p>
                                <h1 className="text-2xl font-semibold tracking-tight">Azure SSO Test</h1>h1>
                                <p className="mt-1.5 text-sm text-muted-foreground">
                                            Isolated login test — does not affect the live auth flow.
                                </p>p>
                      </div>div>
              
                {/* Error */}
                {errorMessage && (
                    <div className="w-full rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                      {errorMessage}
                    </div>div>
                      )}
              
                {/* Sign in button */}
                      <button
                                  onClick={handleSignIn}
                                  className="w-full flex items-center justify-center gap-3 rounded-md bg-[#0078d4] px-6 py-3 text-white font-medium hover:bg-[#106ebe] transition-colors"
                                >
                        {/* Microsoft logo */}
                                <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                                            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                                            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                                            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                                </svg>svg>
                                Sign in with Microsoft
                      </button>button>
              
                      <p className="text-xs text-muted-foreground text-center">
                                On success you will be redirected to <code className="font-mono">/auth-test/success</code>code>
                      </p>p>
              </div>div>
        
              <p className="text-xs text-muted-foreground">
                      ⚠️ This page is for testing only. <a href="/login" className="underline">Go to real login →</a>a>
              </p>p>
        </div>div>
      );
}

export default function AuthTestPage() {
    return (
          <Suspense>
                <SignInContent />
          </Suspense>Suspense>
        );
}</div>
