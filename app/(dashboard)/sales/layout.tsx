import { redirect } from 'next/navigation';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { SalesSidebar } from '@/components/sales/SalesSidebar';
import { SalesTopbar } from '@/components/sales/SalesTopbar';
import '@/styles/anex-sales.css';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const [member, projects] = await Promise.all([
    getAuthenticatedMember().catch(() => null),
    getUserProjects().catch(() => []),
  ]);

  if (!member) redirect('/login');

  return (
    <div className="sales-shell">
      <SalesSidebar member={member} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SalesTopbar member={member} projects={projects} />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--sales-bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
