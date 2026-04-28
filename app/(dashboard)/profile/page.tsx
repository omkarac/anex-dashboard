import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfileData, getProfileStats, getMyAssets, getMyTasks } from '@/lib/queries/profile';
import { ProfileView } from '@/components/profile/profile-view';

export const metadata: Metadata = { title: 'My Profile — Anex' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profile, stats, assets, tasks] = await Promise.all([
    getProfileData(user.id),
    getProfileStats(user.id),
    getMyAssets(user.id),
    getMyTasks(user.id),
  ]);

  if (!profile) redirect('/login');

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your account details and activity within Anex
        </p>
      </div>
      <div className="flex-1">
        <ProfileView profile={profile} stats={stats} assets={assets} tasks={tasks} />
      </div>
    </div>
  );
}
