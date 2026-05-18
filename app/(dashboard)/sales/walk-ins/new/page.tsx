import { getUserProjects } from '@/lib/actions/sales/projects';
import { getActiveTeamMembers } from '@/lib/queries/team';
import { WalkInWizard } from './WalkInWizard';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ project?: string }> };

export default async function NewWalkInPage({ searchParams }: Props) {
  const { project } = await searchParams;
  const [projects, smList] = await Promise.all([
    getUserProjects(),
    getActiveTeamMembers(),
  ]);

  const projectId = project ?? projects[0]?.id ?? '';

  if (!projectId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sales-txt2)' }}>
        <p style={{ fontSize: 14 }}>No project found. Please contact your admin.</p>
      </div>
    );
  }

  return <WalkInWizard projectId={projectId} smList={smList} />;
}
