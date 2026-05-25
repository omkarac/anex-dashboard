// Supabase Edge Function — admin/trigger-scrape
//
// Triggers the NOCAS scraper GitHub Actions workflow via the GitHub REST API
// and returns a tracking_id that the admin panel uses to follow live progress
// in the scrape_log table.
//
// Deploy with:
//   supabase functions deploy admin-trigger-scrape
//
// Required env vars (set via `supabase secrets set`):
//   GITHUB_TOKEN              fine-grained PAT with `actions:write` on the repo
//   GITHUB_OWNER              e.g. "omkarac02"
//   GITHUB_REPO               e.g. "mmr-height-estimator"
//   GITHUB_WORKFLOW_FILE      "scrape.yml"
//   ADMIN_TOKEN               shared secret the admin UI sends in X-Admin-Token
//
// Request body:
//   {
//     "mode": "manual_quick" | "manual_standard" | "manual_deep" | "manual_custom",
//     "from_date"?: "YYYY-MM-DD",   // required only for manual_custom / backfill
//     "to_date"?:   "YYYY-MM-DD",
//     "airport"?:   15 | 16 | 140    // optional: restrict to single airport
//   }
//
// Response:
//   { tracking_id, github_run_url, mode, started_at }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ALLOWED_MODES = new Set([
  "manual_quick",
  "manual_standard",
  "manual_deep",
  "manual_custom",
]);

interface TriggerBody {
  mode: string;
  from_date?: string;
  to_date?: string;
  airport?: number;
}

function cors(headers: HeadersInit = {}): HeadersInit {
  return {
    ...headers,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-admin-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: cors({ "content-type": "application/json", ...(init.headers || {}) }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, { status: 405 });

  // ----- Auth -----
  const adminToken = Deno.env.get("ADMIN_TOKEN");
  if (!adminToken) return json({ error: "server_misconfigured" }, { status: 500 });
  const presented = req.headers.get("x-admin-token");
  if (presented !== adminToken) return json({ error: "unauthorized" }, { status: 401 });

  // ----- Parse body -----
  let body: TriggerBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  if (!ALLOWED_MODES.has(body.mode)) {
    return json({ error: "invalid_mode", allowed: [...ALLOWED_MODES] }, { status: 400 });
  }
  if (body.mode === "manual_custom" && !body.from_date) {
    return json({ error: "from_date required for manual_custom" }, { status: 400 });
  }
  if (body.airport !== undefined && ![15, 16, 140].includes(body.airport)) {
    return json({ error: "airport must be 15, 16, or 140 (MMR)" }, { status: 400 });
  }

  // ----- Generate tracking ID -----
  const trackingId = crypto.randomUUID();

  // ----- Dispatch GitHub workflow -----
  const owner = Deno.env.get("GITHUB_OWNER")!;
  const repo  = Deno.env.get("GITHUB_REPO")!;
  const wf    = Deno.env.get("GITHUB_WORKFLOW_FILE") ?? "scrape.yml";
  const token = Deno.env.get("GITHUB_TOKEN")!;

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${wf}/dispatches`;
  const inputs: Record<string, string> = {
    mode: body.mode,
    tracking_id: trackingId,
  };
  if (body.from_date)        inputs.from_date = body.from_date;
  if (body.to_date)          inputs.to_date   = body.to_date;
  if (body.airport !== undefined) inputs.airport = String(body.airport);

  const ghResp = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs }),
  });

  if (!ghResp.ok) {
    const errText = await ghResp.text();
    console.error("GitHub dispatch failed:", ghResp.status, errText);
    return json(
      { error: "github_dispatch_failed", status: ghResp.status, detail: errText.substring(0, 500) },
      { status: 502 },
    );
  }

  // GitHub's dispatch endpoint returns 204 No Content and gives no run ID directly.
  // We construct a URL to the Actions tab filtered by run name so the admin UI
  // can link out to the live logs. The tracking_id is the canonical handle that
  // links workflow output → scrape_log rows in our DB.
  const actionsUrl = `https://github.com/${owner}/${repo}/actions/workflows/${wf}`;

  return json({
    tracking_id:    trackingId,
    mode:           body.mode,
    started_at:     new Date().toISOString(),
    github_run_url: actionsUrl,
    note:           "Workflow dispatched. Subscribe to scrape_log on tracking_id for progress.",
  });
});
