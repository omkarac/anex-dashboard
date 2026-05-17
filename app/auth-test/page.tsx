'use client';

import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  no_code: 'Sign-in was cancelled or timed out.',
  exchange_failed: 'Token exchange failed. Check config.',
  no_user: 'No user returned after sign-in.',
  unauthorized_domain: 'Only @anexadvisory.com accounts are permitted.',
  deactivated: 'This account has been deactivated.',
};

function SignInContent() {
  const params = useSearchParams();
  const errorKey = params.get('error');
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] || null) : null;

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: window.location.origin + '/auth-test/callback',
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 border border-border rounded-xl p-8">
        <div className="text-center">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Test Environment
          </p>
          <h1 className="text-2xl font-semibold">Azure SSO Test</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Isolated login test.</p>
        </div>
        {errorMessage && (
          <div className="w-full rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 rounded-md bg-[#0078d4] px-6 py-3 text-white"
        >
          <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Sign in with Microsoft
        </button>
        <p className="text-xs text-muted-foreground text-center">
          On success you will be redirected to /auth-test/success
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Testing only.</p>
    </div>
  );
}

export default function AuthTestPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
