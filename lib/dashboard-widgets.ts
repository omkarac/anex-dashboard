export type WidgetId =
  // Existing
  | 'pipeline-board'
  | 'attention-panel'
  | 'deal-aging'
  | 'team-bandwidth'
  | 'activity-feed'
  | 'hot-deals'
  | 'win-rate'
  | 'stale-deals'
  // Personal productivity
  | 'my-day'
  | 'update-streak'
  | 'closing-loop'
  // Team synergy
  | 'handoff-health'
  | 'collab-graph'
  | 'quiet-assets-owner'
  // Velocity / flow
  | 'week-over-week'
  | 'stage-throughput'
  | 'task-sla'
  // Hygiene
  | 'orphaned-work'
  | 'engagement-coverage';

export type WidgetSize = 1 | 2 | 3 | 4;

export type WidgetCategory =
  | 'Personal'
  | 'Synergy'
  | 'Velocity'
  | 'Pipeline'
  | 'Activity'
  | 'Team'
  | 'Insights'
  | 'Hygiene';

export type WidgetDef = {
  id: WidgetId;
  name: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  icon: string;
};

export type WidgetItem = { id: WidgetId; size: WidgetSize };

export type DashboardWindow = {
  id: string;
  name: string;
  widgets: WidgetItem[];
};

export type DashboardState = {
  windows: DashboardWindow[];
  activeIndex: number;
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDef> = {
  // Existing
  'pipeline-board': {
    id: 'pipeline-board',
    name: 'Pipeline Board',
    description: 'Deal-level columns by stage, urgency-ranked with owner and activity signals.',
    category: 'Pipeline',
    defaultSize: 4,
    minSize: 3,
    maxSize: 4,
    icon: '⬛',
  },
  'attention-panel': {
    id: 'attention-panel',
    name: 'Needs Attention',
    description: 'Hot unassigned deals, silent deals, and stalled stages — triage-ready.',
    category: 'Pipeline',
    defaultSize: 2,
    minSize: 1,
    maxSize: 3,
    icon: '⚡',
  },
  'deal-aging': {
    id: 'deal-aging',
    name: 'Time in Stage',
    description: 'Heat bar showing how long active deals have been sitting in each stage.',
    category: 'Pipeline',
    defaultSize: 2,
    minSize: 1,
    maxSize: 2,
    icon: '⏳',
  },
  'team-bandwidth': {
    id: 'team-bandwidth',
    name: 'Team Bandwidth',
    description: "Arc load rings showing each team member's current deal and task load.",
    category: 'Team',
    defaultSize: 2,
    minSize: 2,
    maxSize: 3,
    icon: '◎',
  },
  'activity-feed': {
    id: 'activity-feed',
    name: 'Activity Feed',
    description: 'Date-grouped timeline of recent actions across the entire pipeline.',
    category: 'Activity',
    defaultSize: 2,
    minSize: 2,
    maxSize: 4,
    icon: '≡',
  },
  'hot-deals': {
    id: 'hot-deals',
    name: 'Hot Deals',
    description: 'All hot-temperature active deals sorted by urgency and days silent.',
    category: 'Pipeline',
    defaultSize: 2,
    minSize: 1,
    maxSize: 2,
    icon: '●',
  },
  'win-rate': {
    id: 'win-rate',
    name: 'Win Rate',
    description: "This quarter's win rate as an arc gauge with closed deal breakdown.",
    category: 'Insights',
    defaultSize: 1,
    minSize: 1,
    maxSize: 2,
    icon: '◐',
  },
  'stale-deals': {
    id: 'stale-deals',
    name: 'Stale Pipeline',
    description: 'Deals with no activity in 30+ days — candidates for review or drop.',
    category: 'Insights',
    defaultSize: 2,
    minSize: 1,
    maxSize: 2,
    icon: '○',
  },

  // ─── Personal productivity ────────────────────────────────────────────────
  'my-day': {
    id: 'my-day',
    name: 'My Day',
    description: 'Your tasks due today, silent owned assets, and stage moves you made this week.',
    category: 'Personal',
    defaultSize: 2,
    minSize: 2,
    maxSize: 4,
    icon: '☀',
  },
  'update-streak': {
    id: 'update-streak',
    name: 'Update Streak',
    description: 'Consecutive days you logged activity — calendar dots over the last 30 days.',
    category: 'Personal',
    defaultSize: 1,
    minSize: 1,
    maxSize: 2,
    icon: '✦',
  },
  'closing-loop': {
    id: 'closing-loop',
    name: 'Closing the Loop',
    description: 'Assets where the ball is in your court vs. where you are waiting on others.',
    category: 'Personal',
    defaultSize: 2,
    minSize: 1,
    maxSize: 2,
    icon: '↔',
  },

  // ─── Team synergy ─────────────────────────────────────────────────────────
  'handoff-health': {
    id: 'handoff-health',
    name: 'Handoff Health',
    description: 'Developer share lifecycle — IM → FF → EOI — with stalled stages surfaced.',
    category: 'Synergy',
    defaultSize: 2,
    minSize: 2,
    maxSize: 4,
    icon: '⇢',
  },
  'collab-graph': {
    id: 'collab-graph',
    name: 'Collaboration Graph',
    description: 'Lone-wolf assets vs. genuinely shared ones — surfaces hidden bus-factor risk.',
    category: 'Synergy',
    defaultSize: 2,
    minSize: 2,
    maxSize: 3,
    icon: '⌬',
  },
  'quiet-assets-owner': {
    id: 'quiet-assets-owner',
    name: 'Quiet Assets by Owner',
    description: 'Heatmap of how many of each owner’s assets are aging silent across buckets.',
    category: 'Synergy',
    defaultSize: 2,
    minSize: 2,
    maxSize: 4,
    icon: '▦',
  },

  // ─── Velocity / flow ──────────────────────────────────────────────────────
  'week-over-week': {
    id: 'week-over-week',
    name: 'This Week vs Last',
    description: 'Net deltas in stage moves, updates, tasks closed, and new assets.',
    category: 'Velocity',
    defaultSize: 2,
    minSize: 2,
    maxSize: 3,
    icon: '↗',
  },
  'stage-throughput': {
    id: 'stage-throughput',
    name: 'Stage Throughput',
    description: 'Median days in each stage over 90 days, overlaid with current cohort age.',
    category: 'Velocity',
    defaultSize: 2,
    minSize: 2,
    maxSize: 3,
    icon: '⌛',
  },
  'task-sla': {
    id: 'task-sla',
    name: 'Task SLA',
    description: 'High/urgent task on-time completion rate over the last 30 days, by assignee.',
    category: 'Velocity',
    defaultSize: 2,
    minSize: 2,
    maxSize: 4,
    icon: '✓',
  },

  // ─── Hygiene ──────────────────────────────────────────────────────────────
  'orphaned-work': {
    id: 'orphaned-work',
    name: 'Orphaned Work',
    description: 'Assets and tasks still owned by offboarded members — waiting for handover.',
    category: 'Hygiene',
    defaultSize: 1,
    minSize: 1,
    maxSize: 2,
    icon: '◌',
  },
  'engagement-coverage': {
    id: 'engagement-coverage',
    name: 'Engagement Coverage',
    description: 'Active assets with vs. without a live engagement — paperwork hygiene.',
    category: 'Hygiene',
    defaultSize: 1,
    minSize: 1,
    maxSize: 2,
    icon: '⊕',
  },
};

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  'Personal',
  'Synergy',
  'Velocity',
  'Pipeline',
  'Activity',
  'Team',
  'Insights',
  'Hygiene',
];

// ─── Default presets ──────────────────────────────────────────────────────────

export const PRESET_MY_DAY: DashboardWindow = {
  id: 'my-day-view',
  name: 'My Day',
  widgets: [
    { id: 'my-day', size: 2 },
    { id: 'update-streak', size: 1 },
    { id: 'closing-loop', size: 1 },
    { id: 'pipeline-board', size: 4 },
    { id: 'activity-feed', size: 4 },
  ],
};

export const PRESET_TEAM_SYNERGY: DashboardWindow = {
  id: 'team-synergy-view',
  name: 'Team Synergy',
  widgets: [
    { id: 'team-bandwidth', size: 2 },
    { id: 'collab-graph', size: 2 },
    { id: 'handoff-health', size: 2 },
    { id: 'quiet-assets-owner', size: 2 },
  ],
};

export const PRESET_VELOCITY: DashboardWindow = {
  id: 'velocity-view',
  name: 'Velocity',
  widgets: [
    { id: 'week-over-week', size: 2 },
    { id: 'stage-throughput', size: 2 },
    { id: 'task-sla', size: 4 },
    { id: 'orphaned-work', size: 1 },
    { id: 'engagement-coverage', size: 1 },
  ],
};

export const PRESET_COMMAND_VIEW: DashboardWindow = {
  id: 'command-view',
  name: 'Command View',
  widgets: [
    { id: 'pipeline-board', size: 4 },
    { id: 'attention-panel', size: 3 },
    { id: 'deal-aging', size: 1 },
    { id: 'team-bandwidth', size: 2 },
    { id: 'activity-feed', size: 2 },
  ],
};

export const PRESET_MY_PIPELINE: DashboardWindow = {
  id: 'my-pipeline',
  name: 'My Pipeline',
  widgets: [
    { id: 'hot-deals', size: 2 },
    { id: 'win-rate', size: 1 },
    { id: 'stale-deals', size: 1 },
    { id: 'pipeline-board', size: 4 },
    { id: 'activity-feed', size: 4 },
  ],
};

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  windows: [PRESET_MY_DAY, PRESET_TEAM_SYNERGY, PRESET_VELOCITY, PRESET_COMMAND_VIEW],
  activeIndex: 0,
};
