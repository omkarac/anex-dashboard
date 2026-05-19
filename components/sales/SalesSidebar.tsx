'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { TeamMember } from '@/lib/rbac';

const NAV = [
  { label: 'Dashboard',        href: '/sales/dashboard',          icon: '📊' },
  { label: 'Walk-ins',         href: '/sales/walk-ins',           icon: '🚶' },
  { label: 'Leads',            href: '/sales/leads',              icon: '📞' },
  { label: 'Log Meeting (DAR)',href: '/sales/meetings/new',       icon: '🤝' },
  { label: 'CP Calendar',      href: '/sales/calendar',           icon: '📅' },
  { label: 'My Tasks',         href: '/sales/tasks',              icon: '✅' },
  { label: 'Channel Partners', href: '/sales/channel-partners',  icon: '🏢' },
  { label: 'EOD Report',       href: '/sales/eod',               icon: '📝' },
  { label: 'Logs',             href: '/sales/logs',              icon: '🗂️' },
];

interface Props { member: TeamMember; }

export function SalesSidebar({ member }: Props) {
  const pathname = usePathname();

  return (
    <nav className="sales-sidebar">
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Link href="/sales/dashboard" style={{ textDecoration: 'none', display: 'block' }}>
          <Image
            src="/logo-white.png"
            alt="Anex Advisory"
            width={110}
            height={105}
            priority
            style={{ display: 'block', width: 110, height: 'auto', opacity: 0.95 }}
          />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: 500, marginTop: 6, letterSpacing: '.4px', textTransform: 'uppercase' }}>
            Sales &amp; Marketing CRM
          </div>
        </Link>
      </div>

      {/* Nav Items */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/sales/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', margin: '1px 8px', borderRadius: 8,
                background: active ? 'rgba(201,168,76,.15)' : 'transparent',
                borderLeft: active ? '3px solid var(--anex-gold)' : '3px solid transparent',
                transition: 'background .15s',
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--anex-gold)' : 'rgba(255,255,255,.75)',
                }}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--anex-gold)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'var(--anex-navy)', flexShrink: 0,
          }}>{member.full_name.charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.full_name}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              {member.role.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
