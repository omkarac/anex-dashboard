import { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { EodForm } from './EodForm';

export const metadata: Metadata = { title: 'EOD Report — Anex Sales' };

export default async function EodPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const defaultProjectId = params.project ?? projects[0]?.id ?? '';

  return <EodForm projects={projects} defaultProjectId={defaultProjectId} />;
}
