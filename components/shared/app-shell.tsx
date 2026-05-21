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
  Megaphone,
  LogOut,
  ChevronRight,
  ChevronsLeft,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  BarChart3,
  Handshake,
  ClipboardList,
  FileText,
  Star,
  TrendingUp,
  TrendingDown,
  Grid3X3,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOut } from '@/lib/actions/auth';
import type { TeamMember } from '@/lib/rbac';

export type Vertical = 'capital_markets' | 'sales_marketing';

const NAV_ITEMS: Record<Vertical, { href: string; label: string; icon: React.ElementType; exact?: boolean; adminOnly?: boolean }[]> = {
  capital_markets: [
    { href: '/capital-markets', label: 'Capital Markets', icon: LayoutDashboard, exact: true },
    { href: '/capital-markets/assets', label: 'Assets', icon: Building2 },
    { href: '/capital-markets/developers', label: 'Developers', icon: Users2 },
    { href: '/audit', label: 'Audit Room', icon: ScrollText },
    { href: '/capital-markets/team', label: 'Team', icon: UsersRound, adminOnly: true },
  ],
  sales_marketing: [
    { href: '/sales-marketing', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/sales-marketing/channel-partners', label: 'Channel Partners', icon: Handshake },
    { href: '/sales-marketing/meetings', label: 'Meetings (DAR)', icon: ClipboardList },
    { href: '/sales-marketing/eod', label: 'EOD Report', icon: FileText },
    { href: '/sales-marketing/walk-ins', label: 'Walk-ins MIS', icon: UsersRound },
    { href: '/sales-marketing/priority-leads', label: 'Priority Leads', icon: Star },
    { href: '/sales-marketing/sm-performance', label: 'SM Performance', icon: BarChart3, adminOnly: true },
    { href: '/sales-marketing/cp-review', label: 'CP Review', icon: TrendingUp },
    { href: '/sales-marketing/lost-analysis', label: 'Lost Analysis', icon: TrendingDown },
    { href: '/audit', label: 'Audit Room', icon: ScrollText },
    { href: '/sales-marketing/team', label: 'Team', icon: Grid3X3, adminOnly: true },
  ],
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function NavLink({
  href, label, icon: Icon, exact, collapsed, onClick,
}: {
  href: string; label: string; icon: React.ElementType; exact?: boolean; collapsed?: boolean; onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150 min-h-[44px]',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
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

function SidebarContent({
  member,
  vertical,
  collapsed,
  setCollapsed,
  onNavClick,
}: {
  member: TeamMember;
  vertical: Vertical;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onNavClick?: () => void;
}) {
  const visibleNav = NAV_ITEMS[vertical].filter((item) => !item.adminOnly || member.role === 'admin');

  return (
    <>
      {/* Logo + collapse toggle */}
      <div className={cn(
        'flex h-14 items-center border-b px-3 shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && <AnexLogo collapsed={false} />}
        {collapsed && <AnexLogo collapsed={true} />}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hidden md:flex"
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collapse re-open strip when collapsed */}
      {collapsed && (
        <div className="flex justify-center pt-1 pb-0 hidden md:flex">
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
        <Link
          href="/"
          title={collapsed ? 'Switch vertical' : undefined}
          onClick={onNavClick}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 mb-1 min-h-[44px]"
        >
          <ChevronsLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Switch vertical</span>}
        </Link>
        <div className="border-t mb-1.5" />
        {visibleNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            exact={item.exact}
            collapsed={collapsed}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* Theme toggle + user menu */}
      <div className="border-t px-2 py-2 space-y-1 shrink-0">
        <ThemeToggle collapsed={collapsed} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors cursor-pointer',
              collapsed && 'justify-center'
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.full_name} />}
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
            <DropdownMenuItem className="p-0">
              <Link href="/profile" className="flex w-full items-center px-2 py-1.5">
                <UserCircle className="mr-2 h-3.5 w-3.5" />
                My Profile
              </Link>
            </DropdownMenuItem>
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
    </>
  );
}

function MobilePageTitle({ vertical }: { vertical: Vertical }) {
  const pathname = usePathname();

  const title = (() => {
    const nav = NAV_ITEMS[vertical];
    // Exact match first
    const exact = nav.find(n => n.exact && pathname === n.href);
    if (exact) return exact.label;
    // Prefix match — longest wins
    const prefix = [...nav]
      .filter(n => pathname.startsWith(n.href))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return prefix?.label ?? 'Anex';
  })();

  return <span className="text-sm font-semibold truncate">{title}</span>;
}

export function AppShell({
  member,
  vertical,
  children,
}: {
  member: TeamMember;
  vertical: Vertical;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — desktop: always visible | mobile: overlay drawer */}
      <aside
        className={cn(
          'flex flex-col border-r bg-sidebar shrink-0 transition-all duration-200',
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl flex' // mobile overlay
            : cn('hidden md:flex', collapsed ? 'md:w-14' : 'md:w-56')  // desktop sidebar
        )}
      >
        {/* Mobile close button inside sidebar */}
        <button
          className="md:hidden absolute top-3 right-3 z-10 p-1.5 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent
          member={member}
          vertical={vertical}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onNavClick={() => setMobileOpen(false)}
        />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — hidden on desktop */}
        <div className="flex items-center h-14 border-b px-4 gap-3 md:hidden bg-background shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:bg-accent -ml-1"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <MobilePageTitle vertical={vertical} />
          </div>
          <ThemeToggle collapsed={true} />
          <Avatar className="h-7 w-7 shrink-0">
            {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.full_name} />}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials(member.full_name)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
