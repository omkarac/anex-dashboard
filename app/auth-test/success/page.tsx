import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AuthTestSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth-test?error=no_user');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-8">
      <div className="w-full max-w-sm flex flex-col gap-6 border border-border rounded-xl p-8">
        <div className="text-center">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Test Environment
          </p>
          <h1 className="text-2xl font-semibold">SSO Test Passed</h1>
          <p className="text-sm text-muted-foreground">Microsoft OAuth is working correctly.</p>
        </div>

        <div className="w-full rounded-lg bg-muted/50 border border-border p-4 flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase">Email</span>
            <span className="font-mono">{user!.email}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase">User ID</span>
            <span className="font-mono text-xs break-all">{user!.id}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase">Provider</span>
            <span className="font-mono">{String(user!.app_metadata?.provider ?? 'unknown')}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="/"
            className="w-full text-center rounded-md bg-primary px-6 py-2.5 text-sm text-primary-foreground font-medium"
          >
            Go to Dashboard
          </a>
          <a
            href="/auth-test"
            className="w-full text-center rounded-md border border-border px-6 py-2.5 text-sm hover:bg-muted"
          >
            Test again
          </a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Testing only.</p>
    </div>
  );
}
