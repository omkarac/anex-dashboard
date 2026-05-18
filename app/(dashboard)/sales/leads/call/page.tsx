import { getCallQueue } from '@/lib/actions/sales/leads';
import { TeleCallingForm } from './TeleCallingForm';

export const dynamic = 'force-dynamic';

export default async function TeleCallingPage() {
  const result = await getCallQueue();
  const queue = result.ok ? result.data : [];

  return <TeleCallingForm initialQueue={queue} />;
}
