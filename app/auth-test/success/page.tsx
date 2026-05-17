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
              <div className="w-full max-w-sm flex flex-col gap-6 border border-border rounded-xl p-8 shadow-sm">
                      <div className="text-center">
                                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Test Environment</p>p>
                                <div className="flex items-center justify-center gap-2 mb-1">
                                            <span className="text-2xl">&#x2705;</span>span>
                                            <h1 className="text-2xl font-semibold tracking-tight">SSO Test Passed</h1>h1>
                                </div>div>
                                <p className="text-sm text-muted-foreground">Microsoft OAuth is working correctly.</p>p>
                      </div>div>
              
                      <div className="w-full rounded-lg bg-muted/50 border border-border p-4 flex flex-col gap-3 text-sm">
                                <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground font-medium uppercase">Email</span>span>
                                            <span className="font-mono">{user.email}</span>span>
                                </div>div>
                                <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground font-medium uppercase">User ID</span>span>
                                            <span className="font-mono text-xs break-all">{user.id}</span>span>
                                </div>div>
                                <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground font-medium uppercase">Provider</span>span>
                                            <span className="font-mono">{user.app_metadata?.provider ?? 'unknown'}</span>span>
                                </div>div>
                      </div>div>
              
                      <div className="flex flex-col gap-2">
                                <a href="/" className="w-full text-center rounded-md bg-primary px-6 py-2.5 text-sm text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                                            Go to Dashboard
                                </a>a>
                                <a href="/auth-test" className="w-full text-center rounded-md border border-border px-6 py-2.5 text-sm hover:bg-muted transition-colors">
                                            Test again
                                </a>a>
                      </div>div>
              </div>div>
              <p className="text-xs text-muted-foreground">
                      &#x26A0;&#xFE0F; Testing only. <a href="/login" className="underline">Real login &#x2192;</a>a>
              </p>p>
        </div>div>
      );
}</div>
