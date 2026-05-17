export type WidgetId =
  | 'pipeline-board'
  | 'attention-panel'
  | 'deal-aging'
  | 'team-bandwidth'
  | 'activity-feed'
  | 'hot-deals'
  | 'win-rate'
  | 'stale-deals';

export type WidgetSize = 1 | 2 | 3 | 4;

export type WidgetDef = {
  id: WidgetId;
  name: string;
  description: string;
  category: 'Pipeline' | 'Activity' | 'Team' | 'Insights';
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
};

export const WIDGET_CATEGORIES = ['Pipeline', 'Activity', 'Team', 'Insights'] as const;

// ─── Default presets ──────────────────────────────────────────────────────────

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
  windows: [PRESET_COMMAND_VIEW, PRESET_MY_PIPELINE],
  activeIndex: 0,
};
