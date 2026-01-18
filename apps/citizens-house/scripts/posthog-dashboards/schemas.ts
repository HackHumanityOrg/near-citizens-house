import { z } from "zod"

// PostHog Insight Types
export const InsightTypeSchema = z.enum(["TRENDS", "FUNNELS", "RETENTION", "PATHS", "STICKINESS", "LIFECYCLE"])

// PostHog Display Types
export const DisplayTypeSchema = z.enum([
  "ActionsLineGraph",
  "ActionsLineGraphCumulative",
  "ActionsAreaGraph",
  "ActionsBar",
  "ActionsBarValue",
  "ActionsStackedBar",
  "ActionsTable",
  "ActionsPie",
  "WorldMap",
  "BoldNumber",
  "CalendarHeatmap",
])

// PostHog Math Types
export const MathTypeSchema = z.enum([
  "total",
  "dau",
  "weekly_active",
  "monthly_active",
  "unique_group",
  "sum",
  "min",
  "max",
  "avg",
  "median",
  "p75",
  "p90",
  "p95",
  "p99",
  "first_time_for_user",
  "hogql",
])

// Event definition for insights
export const EventSchema = z.object({
  id: z.union([z.string(), z.null()]),
  name: z.string().optional(),
  type: z.enum(["events", "actions"]).optional().default("events"),
  order: z.number().optional(),
  math: MathTypeSchema.optional(),
  math_property: z.string().optional(),
  math_hogql: z.string().optional(),
  properties: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.array(z.string()), z.boolean()]),
        operator: z
          .enum([
            "exact",
            "is_not",
            "icontains",
            "not_icontains",
            "regex",
            "not_regex",
            "gt",
            "gte",
            "lt",
            "lte",
            "is_set",
            "is_not_set",
            "is_date_exact",
            "is_date_before",
            "is_date_after",
          ])
          .optional(),
        type: z.enum(["event", "person", "element", "session"]).optional(),
      }),
    )
    .optional(),
})

// Filter definition
export const FilterSchema = z.object({
  insight: InsightTypeSchema.optional(),
  events: z.array(EventSchema).optional(),
  actions: z.array(EventSchema).optional(),
  display: DisplayTypeSchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  interval: z.enum(["hour", "day", "week", "month"]).optional(),
  breakdown: z.string().optional(),
  breakdown_type: z.enum(["event", "person", "cohort", "group", "session", "hogql"]).optional(),
  breakdown_normalize_url: z.boolean().optional(),
  properties: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.array(z.string()), z.boolean()]),
        operator: z.string().optional(),
        type: z.enum(["event", "person", "element", "session"]).optional(),
      }),
    )
    .optional(),
  filter_test_accounts: z.boolean().optional(),
  funnel_window_days: z.number().optional(),
  funnel_window_interval: z.number().optional(),
  funnel_window_interval_unit: z.enum(["minute", "hour", "day"]).optional(),
  funnel_viz_type: z.enum(["steps", "time_to_convert", "trends", "historical"]).optional(),
  funnel_order_type: z.enum(["strict", "unordered", "ordered"]).optional(),
  funnel_correlation_person_entity: EventSchema.optional(),
  funnel_correlation_person_converted: z.enum(["true", "false"]).optional(),
  retention_type: z.enum(["retention_recurring", "retention_first_time"]).optional(),
  target_entity: EventSchema.optional(),
  returning_entity: EventSchema.optional(),
  period: z.enum(["Hour", "Day", "Week", "Month"]).optional(),
  total_intervals: z.number().optional(),
  aggregation_group_type_index: z.number().optional(),
  compare: z.boolean().optional(),
  compare_to: z.string().optional(),
  formula: z.string().optional(),
  // Paths-specific filters
  include_event_types: z.array(z.enum(["$pageview", "$screen", "custom_event"])).optional(),
  path_type: z.enum(["$pageview", "$screen", "custom_event"]).optional(),
  start_point: z.string().optional(),
  end_point: z.string().optional(),
  path_groupings: z.array(z.string()).optional(),
  exclude_events: z.array(z.string()).optional(),
  step_limit: z.number().optional(),
  path_replacements: z.array(z.object({ regex: z.string(), alias: z.string() })).optional(),
  local_path_cleaning_filters: z.array(z.object({ regex: z.string(), alias: z.string() })).optional(),
  edge_limit: z.number().optional(),
  min_edge_weight: z.number().optional(),
  max_edge_weight: z.number().optional(),
  hogql_modifiers: z
    .object({
      inCohortVia: z.enum(["auto", "leftjoin", "subquery"]).optional(),
    })
    .optional(),
})

// Insight definition
export const InsightDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  filters: FilterSchema,
  query: z.record(z.string(), z.unknown()).optional(),
})

// Text tile definition (for dashboard documentation)
export const TextTileSchema = z.object({
  type: z.literal("text"),
  body: z.string(),
  layouts: z
    .object({
      sm: z
        .object({
          h: z.number(),
          w: z.number(),
          x: z.number(),
          y: z.number(),
        })
        .optional(),
      xs: z
        .object({
          h: z.number(),
          w: z.number(),
          x: z.number(),
          y: z.number(),
        })
        .optional(),
    })
    .optional(),
})

// Insight tile definition
export const InsightTileSchema = z.object({
  type: z.literal("insight"),
  insight: InsightDefinitionSchema,
  layouts: z
    .object({
      sm: z
        .object({
          h: z.number(),
          w: z.number(),
          x: z.number(),
          y: z.number(),
        })
        .optional(),
      xs: z
        .object({
          h: z.number(),
          w: z.number(),
          x: z.number(),
          y: z.number(),
        })
        .optional(),
    })
    .optional(),
})

// Dashboard tile (union of text and insight)
export const DashboardTileSchema = z.discriminatedUnion("type", [TextTileSchema, InsightTileSchema])

// Dashboard definition
export const DashboardDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  restriction_level: z
    .enum(["everyone_in_project_can_edit", "only_collaborators_can_edit", "everyone_in_project_can_view"])
    .optional(),
  tiles: z.array(DashboardTileSchema),
})

// Cohort definition
export const CohortDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  groups: z.array(
    z.object({
      properties: z.array(
        z.object({
          key: z.string(),
          value: z.union([z.string(), z.array(z.string()), z.boolean()]),
          operator: z.string().optional(),
          type: z.enum(["person", "behavioral", "cohort"]).optional(),
          event_type: z.string().optional(),
          time_value: z.number().optional(),
          time_interval: z.enum(["day", "week", "month"]).optional(),
        }),
      ),
    }),
  ),
  is_static: z.boolean().optional(),
})

// Action step definition (for combining events with OR logic)
export const ActionStepSchema = z.object({
  event: z.string(),
  properties: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.array(z.string()), z.boolean()]),
        operator: z.string().optional(),
        type: z.enum(["event", "person", "element", "session"]).optional(),
      }),
    )
    .optional(),
})

// Action definition (groups multiple events with OR logic)
export const ActionDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(ActionStepSchema),
  tags: z.array(z.string()).optional(),
})

// Alert definition
export const AlertDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  insight_id: z.string().optional(),
  threshold: z.object({
    configuration: z.object({
      absoluteThreshold: z
        .object({
          lower: z.number().optional(),
          upper: z.number().optional(),
        })
        .optional(),
      type: z.enum(["absolute", "relative"]),
    }),
  }),
  condition: z.object({
    type: z.enum(["absolute_value", "relative_increase", "relative_decrease"]),
  }),
  /**
   * Pending period in minutes - condition must be true for this duration before alert fires.
   * Prevents alert flapping from transient spikes.
   */
  pending_period_minutes: z.number().min(0).optional(),
  /**
   * Optional runbook URL for alert response documentation
   */
  runbook_url: z.url().optional(),
  subscribed_users: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
})

// Session recording filter
export const SessionRecordingFilterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  filter_group: z.object({
    type: z.enum(["AND", "OR"]).default("AND"),
    values: z.array(
      z.object({
        type: z.enum(["AND", "OR"]).default("AND"),
        values: z.array(
          z.object({
            key: z.string(),
            value: z.union([z.string(), z.array(z.string()), z.boolean()]),
            operator: z.string().optional(),
            type: z.string().optional(),
          }),
        ),
      }),
    ),
  }),
})

// Complete dashboard configuration
export const DashboardConfigSchema = z.object({
  dashboards: z.array(DashboardDefinitionSchema),
  cohorts: z.array(CohortDefinitionSchema),
  alerts: z.array(AlertDefinitionSchema),
  sessionRecordingFilters: z.array(SessionRecordingFilterSchema),
})

// Export types
export type InsightType = z.infer<typeof InsightTypeSchema>
export type DisplayType = z.infer<typeof DisplayTypeSchema>
export type MathType = z.infer<typeof MathTypeSchema>
export type Event = z.infer<typeof EventSchema>
export type Filter = z.infer<typeof FilterSchema>
export type InsightDefinition = z.infer<typeof InsightDefinitionSchema>
export type TextTile = z.infer<typeof TextTileSchema>
export type InsightTile = z.infer<typeof InsightTileSchema>
export type DashboardTile = z.infer<typeof DashboardTileSchema>
export type DashboardDefinition = z.infer<typeof DashboardDefinitionSchema>
export type CohortDefinition = z.infer<typeof CohortDefinitionSchema>
export type AlertDefinition = z.infer<typeof AlertDefinitionSchema>
export type SessionRecordingFilter = z.infer<typeof SessionRecordingFilterSchema>
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>
export type ActionStep = z.infer<typeof ActionStepSchema>
export type ActionDefinition = z.infer<typeof ActionDefinitionSchema>
