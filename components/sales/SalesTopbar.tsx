'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { TeamMember } from '@/lib/rbac';
import type { SalesProject } from '@/lib/schemas/sales';

interface Props {
  member: TeamMember;
  projects: SalesProject[];
}

function TopbarContent({ member, projects }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentId = searchParams.get('project') ?? projects[0]?.id ?? '';

  const pageTitle = (() => {
    if (pathname.includes('/dashboard')) return 'Dashboard';
    if (pathname.includes('/walk-ins/new')) return 'New Walk-in';
    if (pathname.includes('/walk-ins')) return 'Walk-ins';
    if (pathname.includes('/meetings/new')) return 'Log DAR Meeting';
    if (pathname.includes('/meetings')) return 'Meetings';
    if (pathname.includes('/leads/call')) return 'Tele-calling';
    if (pathname.includes('/leads')) return 'Leads';
    if (pathname.includes('/tasks')) return 'My Tasks';
    if (pathname.includes('/calendar')) return 'CP Calendar';
    if (pathname.includes('/channel-partners')) return 'Channel Partners';
    if (pathname.includes('/eod')) return 'EOD Report';
    if (pathname.includes('/logs')) return 'Activity Logs';
    return 'Sales CRM';
  })();

  return (
    <div className="sales-topbar">
      {/* Mobile hamburger */}
<div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--sales-txt)' }}>
          {pageTitle}
        </h1>
      </div>

      {/* Project switcher — URL-based */}
      {projects.length > 1 && (
        <select
          value={currentId}
          onChange={e => {
            const params = new URLSearchParams(window.location.search);
            params.set('project', e.target.value);
            router.push(`${pathname}?${params.toString()}`);
          }}
          style={{
            height: 36, padding: '0 10px', border: '1.5px solid var(--sales-border)',
            borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)',
            background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sales)',
            minWidth: 160,
          }}
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {projects.length === 1 && (
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt2)', padding: '0 4px' }}>
          {projects[0].name}
        </span>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href="/sales/meetings/new" style={{
          textDecoration: 'none',
          height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--anex-navy)', color: 'white', borderRadius: 8,
          fontSize: 12, fontWeight: 700,
        }}>
          + DAR
        </Link>
        <Link href="/sales/walk-ins/new" style={{
          textDecoration: 'none',
          height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--status-booked)', color: 'white', borderRadius: 8,
          fontSize: 12, fontWeight: 700,
        }}>
          + Walk-in
        </Link>
      </div>

      {/* User avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--anex-navy)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
        cursor: 'pointer',
      }} title={member.full_name}>
        {member.full_name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

export function SalesTopbar({ member, projects }: Props) {
  return (
    <Suspense fallback={<div className="sales-topbar" />}>
      <TopbarContent member={member} projects={projects} />
    </Suspense>
  );
}
