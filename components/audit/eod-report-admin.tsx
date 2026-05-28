'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, CheckCircle2, AlertCircle, Mail, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  updateEodReportConfig,
  setEodOptOut,
  sendEodReportNow,
} from '@/lib/actions/eod-report';
import type { EodRecipientScope, EodReportPayload } from '@/lib/schemas/eod-report';

type CmMember = { id: string; full_name: string; email: string };

type Props = {
  initialConfig: {
    recipient_scope: EodRecipientScope;
    enabled: boolean;
    updated_at: string;
  };
  optOutIds: string[];
  cmMembers: CmMember[];
  previewPayload: EodReportPayload;
};

export function EodReportAdmin({ initialConfig, optOutIds, cmMembers, previewPayload }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<EodRecipientScope>(initialConfig.recipient_scope);
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [optOuts, setOptOuts] = useState<Set<string>>(new Set(optOutIds));

  const [savingConfig, startSavingConfig] = useTransition();
  const [sending, startSending] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [configMsg, setConfigMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sendMsg, setSendMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const isDirty =
    scope !== initialConfig.recipient_scope || enabled !== initialConfig.enabled;

  function saveConfig() {
    setConfigMsg(null);
    startSavingConfig(async () => {
      const res = await updateEodReportConfig({ recipient_scope: scope, enabled });
      if (!res.ok) {
        setConfigMsg({ kind: 'err', text: res.error });
        return;
      }
      setConfigMsg({ kind: 'ok', text: 'Settings saved.' });
      router.refresh();
    });
  }

  function toggleOptOut(memberId: string, currentlyOptedOut: boolean) {
    setTogglingId(memberId);
    const next = new Set(optOuts);
    if (currentlyOptedOut) next.delete(memberId);
    else next.add(memberId);
    setOptOuts(next);

    setEodOptOut(memberId, !currentlyOptedOut)
      .then((res) => {
        if (!res.ok) {
          // roll back local optimistic toggle on failure
          const rollback = new Set(optOuts);
          setOptOuts(rollback);
        } else {
          router.refresh();
        }
      })
      .finally(() => setTogglingId(null));
  }

  function sendNow() {
    setSendMsg(null);
    startSending(async () => {
      const res = await sendEodReportNow();
      if (!res.ok) {
        setSendMsg({ kind: 'err', text: res.error });
        return;
      }
      setSendMsg({
        kind: 'ok',
        text: `Sent to ${res.data.recipient_count} recipient${res.data.recipient_count === 1 ? '' : 's'}. Message id: ${res.data.message_id}`,
      });
    });
  }

  const previewRecipients = previewPayload.recipients.emails;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: settings */}
      <div className="lg:col-span-1 space-y-6">
        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold tracking-tight mb-3">Recipients</h2>
          <div className="space-y-2">
            <RecipientChoice
              icon={<Shield className="h-4 w-4" />}
              title="Admins only"
              detail="All users with the admin role."
              selected={scope === 'admins_only'}
              onSelect={() => setScope('admins_only')}
            />
            <RecipientChoice
              icon={<Users className="h-4 w-4" />}
              title="Whole Capital Markets team"
              detail="Every active CM member (minus opt-outs below)."
              selected={scope === 'cm_team'}
              onSelect={() => setScope('cm_team')}
            />
          </div>
        </section>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold tracking-tight mb-3">Schedule</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium">Send automatically</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mon–Sat at 21:00 IST. Disable to send only on demand.
              </p>
            </div>
          </label>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={saveConfig} disabled={!isDirty || savingConfig}>
            {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
          {configMsg && (
            <InlineMessage kind={configMsg.kind} text={configMsg.text} />
          )}
        </div>

        {scope === 'cm_team' && (
          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold tracking-tight mb-1">Opt-outs</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Uncheck a member to exclude them from the daily email.
            </p>
            <div className="space-y-1 max-h-72 overflow-auto">
              {cmMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No active CM members.</p>
              ) : (
                cmMembers.map((m) => {
                  const isOptedOut = optOuts.has(m.id);
                  const receives = !isOptedOut;
                  return (
                    <label
                      key={m.id}
                      className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-muted/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={receives}
                          disabled={togglingId === m.id}
                          onChange={() => toggleOptOut(m.id, isOptedOut)}
                          className="h-4 w-4"
                        />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{m.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                        </div>
                      </div>
                      {togglingId === m.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </label>
                  );
                })
              )}
            </div>
          </section>
        )}
      </div>

      {/* Right: preview + send */}
      <div className="lg:col-span-2 space-y-4">
        <section className="border rounded-lg p-4 bg-card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Today&apos;s preview</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live data for {previewPayload.report_date_ist} (IST).
              </p>
            </div>
            <Button onClick={sendNow} disabled={sending || previewRecipients.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send now
            </Button>
          </div>

          {sendMsg && (
            <div className="mb-3">
              <InlineMessage kind={sendMsg.kind} text={sendMsg.text} />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <PreviewTile label="Pipeline" value={`₹${previewPayload.kpis.active_pipeline_cr.toFixed(1)} Cr`} />
            <PreviewTile label="Active deals" value={String(previewPayload.kpis.active_count)} />
            <PreviewTile label="Hot" value={String(previewPayload.kpis.hot_count)} />
            <PreviewTile label="Win rate" value={`${previewPayload.kpis.win_rate_pct}%`} />
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Today&apos;s activity
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            <MiniStat label="Stage moves" value={previewPayload.today.status_changes} />
            <MiniStat label="Updates" value={previewPayload.today.updates} />
            <MiniStat label="Tasks closed" value={previewPayload.today.tasks_completed} />
            <MiniStat label="Tasks new" value={previewPayload.today.tasks_created} />
            <MiniStat label="New assets" value={previewPayload.today.new_assets} />
            <MiniStat label="Won" value={previewPayload.today.won} />
            <MiniStat label="Dropped" value={previewPayload.today.dropped} />
            <MiniStat label="Active members" value={previewPayload.today.active_members} />
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Per-member activity
          </h3>
          {previewPayload.member_rows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic mb-4">
              No CM activity logged today.
            </p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left font-medium py-1.5 px-2">Member</th>
                    <th className="text-right font-medium py-1.5 px-2">Updates</th>
                    <th className="text-right font-medium py-1.5 px-2">Moves</th>
                    <th className="text-right font-medium py-1.5 px-2">Tasks ✓</th>
                    <th className="text-right font-medium py-1.5 px-2">Tasks +</th>
                    <th className="text-right font-medium py-1.5 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewPayload.member_rows.map((m) => (
                    <tr key={m.member_id} className="border-t">
                      <td className="py-1.5 px-2">{m.full_name}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{m.updates}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{m.status_changes}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{m.tasks_completed}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{m.tasks_created}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{m.total_actions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Recipients ({previewRecipients.length})
          </h3>
          {previewRecipients.length === 0 ? (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              No eligible recipients for the current scope. &ldquo;Send now&rdquo; is disabled.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {previewRecipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 text-xs rounded border bg-muted/30 px-2 py-0.5"
                >
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  {email}
                </span>
              ))}
              {previewPayload.recipients.excluded_count > 0 && (
                <span className="text-xs text-muted-foreground self-center ml-1">
                  · {previewPayload.recipients.excluded_count} opted out
                </span>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RecipientChoice({
  icon,
  title,
  detail,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-md border p-3 transition-colors ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        </div>
      </div>
    </button>
  );
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-muted/30 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-medium tabular-nums">{value}</div>
    </div>
  );
}

function InlineMessage({ kind, text }: { kind: 'ok' | 'err'; text: string }) {
  const Icon = kind === 'ok' ? CheckCircle2 : AlertCircle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${
        kind === 'ok' ? 'text-emerald-600' : 'text-destructive'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}
