import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDeveloperById } from '@/lib/queries/developers';
import { DeveloperDetailView } from '@/components/developers/developer-detail-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const dev = await getDeveloperById(id);
  return { title: dev ? `${dev.name} — Anex` : 'Developer — Anex' };
}

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dev = await getDeveloperById(id);
  if (!dev) notFound();

  return <DeveloperDetailView dev={dev} />;
}
