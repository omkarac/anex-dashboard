'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { KpiTile } from '@/components/sales/KpiTile';
import { getTodayMeetingCounts, createEodReport } from '@/lib/actions/sales/meetings';

export default function EodPage() {
  const router = useRouter();
  const projectId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('project') ?? ''
    : '';

  const [counts, setCounts] = useState({ obm: 0, ibm: 0, unique_obm: 0, repeat_obm: 0, unique_ibm: 0, repeat_ibm: 0 });
  const [loading, setLoading] = useState(true);
  const [callsDialled, setCallsDialled] = useState('');
  const [callsConnected, setCallsConnected] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function fetchCounts() {
    setLoading(true);
    if (projectId) {
      const data = await getTodayMeetingCounts(projectId);
      setCounts(data);
    }
    setLoading(false);
  }

  useEffect(() => { fetchCounts(); }, [projectId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    const res = await createEodReport({
      project_id: projectId,
      report_date: new Date().toISOString().split('T')[0],
      calls_dialled: parseInt(callsDialled || '0', 10),
      calls_connected: parseInt(callsConnected || '0', 10),
      notes: notes || undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 gap-4">
        <div className="text-2xl">✓</div>
        <h2 className="text-lg font-semibold">EOD Report Submitted</h2>
        <p className="text-sm text-muted-foreground">Your end-of-day report has been saved.</p>
        <Button onClick={() => router.push(`/sales-marketing?project=${projectId}`)}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">EOD Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCounts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 p-6 max-w-2xl space-y-6">
        {/* Auto-computed section */}
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Today&apos;s Activity (auto-computed)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiTile label="OBMs"        value={counts.obm}        color="teal"   />
            <KpiTile label="IBMs"        value={counts.ibm}        color="purple" />
            <KpiTile label="Unique OBMs" value={counts.unique_obm} color="navy"   />
            <KpiTile label="Repeat OBMs" value={counts.repeat_obm} color="slate"  />
            <KpiTile label="Unique IBMs" value={counts.unique_ibm} color="navy"   />
            <KpiTile label="Repeat IBMs" value={counts.repeat_ibm} color="slate"  />
          </div>
        </div>

        {/* Manual entry section */}
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Manual Entry</h2>
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Calls Dialled</label>
                <input
                  type="number"
                  min="0"
                  value={callsDialled}
                  onChange={e => setCallsDialled(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Calls Connected</label>
                <input
                  type="number"
                  min="0"
                  value={callsConnected}
                  onChange={e => setCallsConnected(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any observations, highlights, or blockers from today..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={submitting || !projectId}>
          {submitting ? 'Submitting...' : 'Submit EOD Report'}
        </Button>
      </div>
    </div>
  );
}
