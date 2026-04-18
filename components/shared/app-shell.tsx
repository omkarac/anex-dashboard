'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users2,
  ScrollText,
  UsersRound,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOut } from '@/lib/actions/auth';
import type { TeamMember } from '@/lib/rbac';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/assets', label: 'Assets', icon: Building2 },
  { href: '/developers', label: 'Developers', icon: Users2 },
  { href: '/logs', label: 'Activity Logs', icon: ScrollText },
  { href: '/team', label: 'Team', icon: UsersRound, adminOnly: true },
];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function NavLink({
  href, label, icon: Icon, exact, collapsed,
}: {
  href: string; label: string; icon: React.ElementType; exact?: boolean; collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function AnexLogo({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const src = mounted && resolvedTheme === 'dark' ? '/logo-white.png' : '/logo-dark.png';

  if (collapsed) {
    return (
      <div className="flex items-center justify-center h-8 w-8">
        {mounted && (
          <Image src={src} alt="Anex" width={28} height={28} className="object-contain" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      {mounted && (
        <Image src={src} alt="Anex" width={28} height={28} className="object-contain shrink-0" />
      )}
      <span className="font-semibold text-sm tracking-wide text-sidebar-foreground">
        Anex
      </span>
    </div>
  );
}

export function AppShell({ member, children }: { member: TeamMember; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || member.role === 'admin');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r bg-sidebar transition-all duration-200 shrink-0',
          collapsed ? 'w-14' : 'w-56'
        )}
      >
        {/* Logo + collapse toggle */}
        <div className={cn(
          'flex h-14 items-center border-b px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && <AnexLogo collapsed={false} />}
          {collapsed && <AnexLogo collapsed={true} />}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
          {collapsed && (
            <button
              className="absolute left-14 top-3.5 hidden"
              onClick={() => setCollapsed(false)}
            />
          )}
        </div>

        {/* Collapse re-open strip when collapsed */}
        {collapsed && (
          <div className="flex justify-center pt-1 pb-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {visibleNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              exact={item.exact}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Theme toggle + user menu */}
        <div className="border-t px-2 py-2 space-y-1">
          <ThemeToggle collapsed={collapsed} />

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors cursor-pointer',
                collapsed && 'justify-center'
              )}
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials(member.full_name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="truncate text-xs font-medium leading-none text-sidebar-foreground">
                      {member.full_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground mt-0.5 capitalize">
                      {member.role}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium">{member.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive p-0">
                <form action={signOut} className="w-full">
                  <button type="submit" className="flex w-full items-center px-2 py-1.5">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
