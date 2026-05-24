import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = {
  title: 'Pending approval — Anex',
};

// Sign-out is a server action so the page needs no client JS to function.
async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read directly (not via currentUser) — currentUser redirects pending members
  // back here, which would loop.
  const service = createServiceClient();
  const { data: member } = await service
    .from('team_members')
    .select('full_name, email, status, is_active')
    .eq('id', user.id)
    .single();

  // Released members shouldn't sit on the holding page.
  if (member && member.is_active && member.status === 'active') {
    redirect('/');
  }

  const offboarded = !member || !member.is_active || member.status === 'deactivated';

  const heading = offboarded ? 'Account deactivated' : 'Awaiting approval';
  const message = offboarded
    ? 'Your access to the Anex workspace has been removed. If you believe this is a mistake, contact your administrator.'
    : 'Your account has been created and is waiting for an administrator to assign your role and department. You’ll get access as soon as you’re approved.';

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Status accent bar — amber for pending, red for offboarded */}
          <div
            className={`h-1 w-full ${offboarded ? 'bg-[#B91C1C]' : 'bg-[#B45309]'}`}
            aria-hidden
          />
          <div className="px-8 py-10">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  offboarded ? 'bg-[#B91C1C]' : 'bg-[#B45309]'
                }`}
                aria-hidden
              />
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {offboarded ? 'No access' : 'Pending'}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {heading}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {message}
            </p>

            {member && (
              <dl className="mt-6 space-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Signed in as</dt>
                  <dd className="font-medium text-foreground">{member.email}</dd>
                </div>
              </dl>
            )}

            <form action={signOut} className="mt-8">
              <button
                type="submit"
                className="h-11 w-full rounded-lg border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Anex Advisory. Internal use only.
        </p>
      </div>
    </main>
  );
}
