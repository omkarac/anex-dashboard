import { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { EodForm } from './EodForm';

export const metadata: Metadata = { title: 'EOD Report — Anex Sales' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ project?: string }> };

export default async function EodPage({ searchParams }: Props) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const defaultProjectId = params.project ?? projects[0]?.id ?? '';

  if (!defaultProjectId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sales-txt2)' }}>
        <p style={{ fontSize: 14 }}>No project found. Please contact your admin.</p>
      </div>
    );
  }

  return <EodForm projects={projects} defaultProjectId={defaultProjectId} />;
}
