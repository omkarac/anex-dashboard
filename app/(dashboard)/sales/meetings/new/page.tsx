import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { DarForm } from './DarForm';

export const metadata: Metadata = { title: 'Log DAR Meeting — Anex Sales' };

export default async function DarMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ cp?: string; project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();

  return (
    <div style={{ padding: 'clamp(12px, 4vw, 24px)', maxWidth: 620, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: 'var(--sales-txt3)' }}>
        <Link href="/sales/dashboard" style={{ color: 'var(--sales-txt3)', textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color: 'var(--sales-txt2)', fontWeight: 600 }}>Log DAR Meeting</span>
      </div>

      <div className="sales-card">
        <div className="sales-card-header">
          <div>
            <div className="sales-card-title">Log DAR Meeting</div>
            <div className="sales-card-sub">
              Meeting Category (Unique/Repeat) and SM are computed automatically.
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--sales-txt3)', fontSize: 14 }}>
            No projects assigned. Contact your sales head.
          </div>
        ) : (
          <div style={{ padding: '20px 20px 24px' }}>
            <Suspense fallback={null}>
              <DarForm projects={projects} defaultCpId={params.cp} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
