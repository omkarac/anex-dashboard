'use client';

import { useState } from 'react';
import { SalesSidebar } from './SalesSidebar';
import { SalesTopbar } from './SalesTopbar';
import type { TeamMember } from '@/lib/rbac';
import type { SalesProject } from '@/lib/schemas/sales';

interface Props {
  member: TeamMember;
  projects: SalesProject[];
  children: React.ReactNode;
}

export function SalesShell({ member, projects, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile backdrop — closes sidebar when tapped */}
      {mobileOpen && (
        <div
          className="sales-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <SalesSidebar
        member={member}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <SalesTopbar
          member={member}
          projects={projects}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--sales-bg)' }}>
          {children}
        </main>
      </div>
    </>
  );
}
