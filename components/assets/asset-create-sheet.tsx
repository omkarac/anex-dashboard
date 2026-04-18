'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { createAsset } from '@/lib/actions/assets';
import { ASSET_STATUS_LABELS, ASSET_TEMPERATURE_LABELS, ASSET_TYPE_LABELS, REGULATION_OPTIONS } from '@/lib/enums/asset';
import type { AssetStatus, AssetTemperature, AssetType } from '@/lib/schemas/asset';

const STATUS_OPTIONS = Object.keys(ASSET_STATUS_LABELS) as AssetStatus[];
const TEMPERATURE_OPTIONS = Object.keys(ASSET_TEMPERATURE_LABELS) as AssetTemperature[];
const TYPE_OPTIONS = Object.keys(ASSET_TYPE_LABELS) as AssetType[];

export function AssetCreateSheet() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createAsset(formData);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        New Asset
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Add New Asset</SheetTitle>
            <SheetDescription>
              Enter the details for the new real-estate opportunity.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4 flex-1">
            {/* Core fields */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Basic Info
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="property_name">Property Name *</Label>
                <Input id="property_name" name="property_name" required placeholder="e.g. Dadar Plot — Saraswat Coop" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="e.g. Dadar West, Mumbai" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="new"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="temperature">Temperature</Label>
                  <select
                    id="temperature"
                    name="temperature"
                    defaultValue="none"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {TEMPERATURE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{ASSET_TEMPERATURE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="asset_type">Asset Type</Label>
                  <select
                    id="asset_type"
                    name="asset_type"
                    defaultValue=""
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">— None —</option>
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="spoc_agent">SPOC Agent</Label>
                  <Input id="spoc_agent" name="spoc_agent" placeholder="Name" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="resource">Source / Resource</Label>
                <Input id="resource" name="resource" placeholder="Who brought this deal?" />
              </div>
            </section>

            {/* Financials */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Financials (Cr.)
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="topline_cr">Topline</Label>
                  <Input id="topline_cr" name="topline_cr" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="profit_cr">Profit</Label>
                  <Input id="profit_cr" name="profit_cr" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="initial_investment_cr">Investment</Label>
                  <Input id="initial_investment_cr" name="initial_investment_cr" type="number" step="0.01" placeholder="0.00" />
                </div>
              </div>
            </section>

            {/* Sizes */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Areas (sq.m.)
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot_size_sqm">Plot Size</Label>
                  <Input id="plot_size_sqm" name="plot_size_sqm" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fsi_potential">FSI Potential</Label>
                  <Input id="fsi_potential" name="fsi_potential" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="development_potential_sqm">Dev Potential</Label>
                  <Input id="development_potential_sqm" name="development_potential_sqm" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sale_area_sqm">Sale Area</Label>
                  <Input id="sale_area_sqm" name="sale_area_sqm" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rehab_area_sqm">Rehab Area</Label>
                  <Input id="rehab_area_sqm" name="rehab_area_sqm" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sale_rate_psf">Sale Rate (PSF)</Label>
                  <Input id="sale_rate_psf" name="sale_rate_psf" type="number" step="0.01" placeholder="0.00" />
                </div>
              </div>
            </section>

            {/* Regulations */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Regulations
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label>Applicable Regulations</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {REGULATION_OPTIONS.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" name="regulations" value={r} className="rounded" />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="regulation_notes">Regulation Notes</Label>
                <Textarea id="regulation_notes" name="regulation_notes" rows={2} placeholder="Additional zoning or regulation details" />
              </div>
            </section>

            {/* Notes */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="handover_notes">Handover Notes</Label>
                <Textarea id="handover_notes" name="handover_notes" rows={2} placeholder="Key context from the source" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="next_step">Next Step</Label>
                <Input id="next_step" name="next_step" placeholder="What needs to happen next?" />
              </div>
            </section>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <SheetFooter className="p-0 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Asset
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
