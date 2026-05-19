import { redirect } from 'next/navigation';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { SalesShell } from '@/components/sales/SalesShell';
import '@/styles/anex-sales.css';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const [member, projects] = await Promise.all([
    getAuthenticatedMember().catch(() => null),
    getUserProjects().catch(() => []),
  ]);

  if (!member) redirect('/login');

  return (
    <div className="sales-shell">
      <SalesShell member={member} projects={projects}>
        {children}
      </SalesShell>
    </div>
  );
}
