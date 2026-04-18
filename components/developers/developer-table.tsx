'use client';

import { useState } from 'react';
import { Building2, Mail, Phone, Share2 } from 'lucide-react';
import { formatDate, formatTimeAgo } from '@/lib/utils/formatters';
import type { DeveloperWithStats, ShareWithDetails } from '@/lib/queries/developers';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

type Props = { developers: DeveloperWithStats[] };

export function DeveloperTable({ developers }: Props) {
  const [drawerDev, setDrawerDev] = useState<DeveloperWithStats | null>(null);

  if (developers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="h-8 w-8 mb-3 opacity-30" />
        <p className="text-sm">No developers yet. Add one to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {['Developer', 'Contact', 'Shares', 'Last Shared'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {developers.map((dev) => (
              <tr
                key={dev.id}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setDrawerDev(dev)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{dev.name}</p>
                  {dev.contact_person && (
                    <p className="text-xs text-muted-foreground mt-0.5">{dev.contact_person}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    {dev.contact_email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />{dev.contact_email}
                      </span>
                    )}
                    {dev.contact_phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />{dev.contact_phone}
                      </span>
                    )}
                    {!dev.contact_email && !dev.contact_phone && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {dev.active_shares}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {dev.last_shared_at ? formatTimeAgo(dev.last_shared_at) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Developer detail drawer */}
      <Sheet open={!!drawerDev} onOpenChange={(o) => !o && setDrawerDev(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {drawerDev && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle>{drawerDev.name}</SheetTitle>
                {drawerDev.contact_person && (
                  <p className="text-sm text-muted-foreground">{drawerDev.contact_person}</p>
                )}
              </SheetHeader>
              <div className="p-4 flex flex-col gap-4">
                {(drawerDev.contact_email || drawerDev.contact_phone) && (
                  <div className="flex flex-col gap-1.5">
                    {drawerDev.contact_email && (
                      <a href={`mailto:${drawerDev.contact_email}`} className="flex items-center gap-2 text-sm hover:underline">
                        <Mail className="h-4 w-4 text-muted-foreground" />{drawerDev.contact_email}
                      </a>
                    )}
                    {drawerDev.contact_phone && (
                      <span className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />{drawerDev.contact_phone}
                      </span>
                    )}
                  </div>
                )}
                {drawerDev.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">{drawerDev.notes}</p>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Added {formatDate(drawerDev.created_at)}
                  </p>
                  <p className="text-sm">{drawerDev.active_shares} active {drawerDev.active_shares === 1 ? 'share' : 'shares'}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
