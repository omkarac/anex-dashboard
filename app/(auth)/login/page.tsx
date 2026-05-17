import { LoginForm } from '@/components/auth/login-form';
import { LoginLogoTrigger } from '@/components/auth/login-logo-trigger';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in — Anex',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; key?: string }>;
}) {
  const { error, key } = await searchParams;

  // Compare server-side — secret never reaches the client bundle
  const adminSecret = process.env.ADMIN_LOGIN_SECRET;
  const showAdminForm = Boolean(adminSecret && key === adminSecret);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — brand */}
      <div className="hidden lg:flex w-[45%] flex-col items-center justify-center bg-primary px-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-8 text-primary-foreground">
          <LoginLogoTrigger />
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight">Anex</h1>
            <p className="mt-2 text-primary-foreground/70 text-sm tracking-widest uppercase">
              Advisory Platform
            </p>
          </div>
          <div className="w-12 h-px bg-primary-foreground/30" />
          <p className="text-center text-sm text-primary-foreground/60 max-w-xs leading-relaxed">
            Internal pipeline management for real-estate opportunities.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              {showAdminForm ? 'Admin sign in' : 'Welcome back'}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {showAdminForm
                ? 'Use your administrator credentials below.'
                : 'Sign in to your Anex workspace.'}
            </p>
          </div>
          <LoginForm urlError={error} showAdminForm={showAdminForm} />
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Anex Advisory. Internal use only.
        </p>
      </div>
    </div>
  );
}
