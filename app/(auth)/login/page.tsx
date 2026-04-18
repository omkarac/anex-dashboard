import { LoginForm } from '@/components/auth/login-form';
import { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Sign in — Anex',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — brand */}
      <div className="hidden lg:flex w-[45%] flex-col items-center justify-center bg-primary px-16 relative overflow-hidden">
        {/* Subtle geometric texture */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-8 text-primary-foreground">
          <Image
            src="/logo-white.png"
            alt="Anex"
            width={120}
            height={120}
            className="object-contain"
            priority
          />
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

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex flex-col items-center gap-3">
          <Image
            src="/logo-dark.png"
            alt="Anex"
            width={64}
            height={64}
            className="object-contain dark:hidden"
          />
          <Image
            src="/logo-white.png"
            alt="Anex"
            width={64}
            height={64}
            className="object-contain hidden dark:block"
          />
          <span className="font-semibold tracking-wide text-lg">Anex</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with your Anex email address.
            </p>
          </div>
          <LoginForm urlError={error} sent={sent === '1'} />
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Anex Advisory. Internal use only.
        </p>
      </div>
    </div>
  );
}
