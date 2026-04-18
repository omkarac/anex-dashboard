'use client';

import { useRouter } from 'next/navigation';
import { Building2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ViewToggle({ active }: { active: 'list' | 'shares' }) {
  const router = useRouter();
  return (
    <div className="flex items-center rounded-md border p-0.5 gap-0.5">
      <Button
        size="sm"
        variant={active === 'list' ? 'default' : 'ghost'}
        className="h-7 px-2.5"
        onClick={() => router.push('/developers?view=list')}
      >
        <Building2 className="mr-1.5 h-3.5 w-3.5" />
        Developers
      </Button>
      <Button
        size="sm"
        variant={active === 'shares' ? 'default' : 'ghost'}
        className="h-7 px-2.5"
        onClick={() => router.push('/developers?view=shares')}
      >
        <Share2 className="mr-1.5 h-3.5 w-3.5" />
        All Shares
      </Button>
    </div>
  );
}
