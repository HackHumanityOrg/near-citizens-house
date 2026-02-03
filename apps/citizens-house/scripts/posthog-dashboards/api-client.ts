import { z } from "zod"
import type {
  DashboardDefinition,
  CohortDefinition,
  InsightDefinition,
  Filter,
  Event,
  ActionDefinition,
} from "./schemas"

/**
 * PostHog API configuration
 * Note: US Cloud uses us.posthog.com for private endpoints (CRUD operations)
 * and us.i.posthog.com for public endpoints (event ingestion)
 */
const API_CONFIG = {
  baseUrl: "https://us.posthog.com",
  version: "v1",
  /**
   * Retry configuration for API requests
   * PostHog rate limits: 240 requests/min, 1200 requests/hour
   */
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
} as const

/**
 * Environment variable schema
 */
const EnvSchema = z.object({
  POSTHOG_PERSONAL_API_KEY: z.string().min(1, "POSTHOG_PERSONAL_API_KEY is required"),
  POSTHOG_PROJECT_ID: z.string().min(1, "POSTHOG_PROJECT_ID is required"),
})

type Env = z.infer<typeof EnvSchema>

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
  const delay = Math.min(exponentialDelay + jitter, maxDelay)
  return Math.max(0, delay)
}

/**
 * API response types
 */

/**
 * PostHog event as returned from the events API
 */
export interface PostHogEvent {
  uuid: string
  event: string
  distinct_id: string
  properties: Record<string, unknown>
  timestamp: string
  created_at: string
}

interface PaginatedEventsResponse {
  results: PostHogEvent[]
  next: string | null
}

interface DashboardResponse {
  id: number
  name: string
  description: string | null
  pinned: boolean
  created_at: string
  deleted: boolean
  tags: string[]
}

/**
 * Dashboard response with tile details included
 * Used when we need to access insights attached to a dashboard
 */
interface DashboardWithTiles extends DashboardResponse {
  tiles: Array<{
    id: number
    insight: { id: number } | null
    text: { body: string } | null
    layouts: Record<string, unknown>
  }>
}

interface InsightResponse {
  id: number
  short_id: string
  name: string
  description: string | null
  filters: Record<string, unknown>
  query: Record<string, unknown> | null
  deleted: boolean
  dashboard_tiles: Array<{
    id: number
    dashboard_id: number
    layouts: Record<string, unknown>
  }>
}

interface CohortResponse {
  id: number
  name: string
  description: string
  deleted: boolean
  filters: Record<string, unknown>
  is_calculating: boolean
  created_at: string
  count: number | null
}

interface DashboardTileResponse {
  id: number
  dashboard_id: number
  insight_id: number | null
  text: string | null
  layouts: Record<string, unknown>
}

interface ActionResponse {
  id: number
  name: string
  description: string | null
  steps: Array<{
    id: string
    event: string
    properties: Array<{
      key: string
      value: string | string[] | boolean
      operator?: string
      type?: string
    }> | null
  }>
  tags: string[]
  deleted: boolean
  created_at: string
}

/**
 * PostHog API Client for dashboard management
 */
export class PostHogApiClient {
  private readonly apiKey: string
  private readonly projectId: string
  private readonly baseUrl: string

  constructor(env?: Partial<Env>) {
    const envResult = EnvSchema.safeParse({
      POSTHOG_PERSONAL_API_KEY: env?.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_PERSONAL_API_KEY,
      POSTHOG_PROJECT_ID: env?.POSTHOG_PROJECT_ID || process.env.POSTHOG_PROJECT_ID,
    })

    if (!envResult.success) {
      throw new Error(`Invalid environment configuration: ${envResult.error.message}`)
    }

    this.apiKey = envResult.data.POSTHOG_PERSONAL_API_KEY
    this.projectId = envResult.data.POSTHOG_PROJECT_ID
    this.baseUrl = API_CONFIG.baseUrl
  }

  /**
   * Make an authenticated request to the PostHog API with retry logic
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param body - Request body (optional)
   * @returns Parsed response
   * @throws Error after max retries exceeded
   */
  private async request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    }

    // Debug logging for troubleshooting
    if (process.env.POSTHOG_DEBUG === "true") {
      console.log(`[DEBUG] ${method} ${url}`)
    }

    const { maxRetries, baseDelayMs, maxDelayMs, retryableStatusCodes } = API_CONFIG.retry
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })

        // Check for rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After")
          const delayMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : calculateBackoff(attempt, baseDelayMs, maxDelayMs)

          if (attempt < maxRetries) {
            console.warn(
              `Rate limited (429). Retrying in ${Math.round(delayMs / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`,
            )
            await sleep(delayMs)
            continue
          }
        }

        // Check for retryable errors
        if (!response.ok && (retryableStatusCodes as readonly number[]).includes(response.status)) {
          if (attempt < maxRetries) {
            const delayMs = calculateBackoff(attempt, baseDelayMs, maxDelayMs)
            console.warn(
              `Request failed (${response.status}). Retrying in ${Math.round(delayMs / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`,
            )
            await sleep(delayMs)
            continue
          }
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`PostHog API error (${response.status}): ${response.statusText}\n${errorText}`)
        }

        // Handle empty responses
        const text = await response.text()
        if (!text) {
          return {} as T
        }

        return JSON.parse(text) as T
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Retry on network errors
        if (attempt < maxRetries && !lastError.message.includes("PostHog API error")) {
          const delayMs = calculateBackoff(attempt, baseDelayMs, maxDelayMs)
          console.warn(
            `Network error: ${lastError.message}. Retrying in ${Math.round(delayMs / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`,
          )
          await sleep(delayMs)
          continue
        }

        throw lastError
      }
    }

    throw lastError || new Error("Max retries exceeded")
  }

  // ==========================================
  // Dashboard Operations
  // ==========================================

  /**
   * List all dashboards in the project
   */
  async listDashboards(): Promise<DashboardResponse[]> {
    const response = await this.request<{ results: DashboardResponse[] }>(
      "GET",
      `/api/projects/${this.projectId}/dashboards/`,
    )
    return response.results
  }

  /**
   * Get a dashboard by ID
   */
  async getDashboard(dashboardId: number): Promise<DashboardResponse> {
    return this.request<DashboardResponse>("GET", `/api/projects/${this.projectId}/dashboards/${dashboardId}/`)
  }

  /**
   * Create a new dashboard
   */
  async createDashboard(name: string, description?: string, tags?: string[]): Promise<DashboardResponse> {
    return this.request<DashboardResponse>("POST", `/api/projects/${this.projectId}/dashboards/`, {
      name,
      description,
      tags,
      pinned: false,
    })
  }

  /**
   * Update an existing dashboard
   */
  async updateDashboard(
    dashboardId: number,
    updates: Partial<{
      name: string
      description: string
      tags: string[]
      pinned: boolean
    }>,
  ): Promise<DashboardResponse> {
    return this.request<DashboardResponse>(
      "PATCH",
      `/api/projects/${this.projectId}/dashboards/${dashboardId}/`,
      updates,
    )
  }

  /**
   * Delete a dashboard (soft delete via PATCH)
   */
  async deleteDashboard(dashboardId: number): Promise<void> {
    await this.request<void>("PATCH", `/api/projects/${this.projectId}/dashboards/${dashboardId}/`, {
      deleted: true,
    })
  }

  /**
   * Get a dashboard with its tiles included
   * Used when we need to access insights attached to a dashboard
   */
  async getDashboardWithTiles(dashboardId: number): Promise<DashboardWithTiles> {
    return this.request<DashboardWithTiles>("GET", `/api/projects/${this.projectId}/dashboards/${dashboardId}/`)
  }

  /**
   * Delete a dashboard and its exclusive insights (not shared with other dashboards)
   * This prevents orphaned insights while preserving insights used elsewhere
   * @returns Number of insights deleted
   */
  async deleteDashboardWithInsights(dashboardId: number): Promise<{ insightsDeleted: number }> {
    // Get dashboard tiles to find attached insights
    const dashboard = await this.getDashboardWithTiles(dashboardId)

    // Delete only insights that are exclusive to this dashboard
    let insightsDeleted = 0
    for (const tile of dashboard.tiles || []) {
      if (tile.insight?.id) {
        const insight = await this.getInsight(tile.insight.id)
        // Only delete if this insight is not attached to any other dashboard
        const otherDashboards = insight.dashboard_tiles.filter((t) => t.dashboard_id !== dashboardId)
        if (otherDashboards.length === 0) {
          await this.deleteInsight(tile.insight.id)
          insightsDeleted++
        }
      }
    }

    // Delete the dashboard itself
    await this.deleteDashboard(dashboardId)

    return { insightsDeleted }
  }

  /**
   * Find a dashboard by name
   */
  async findDashboardByName(name: string): Promise<DashboardResponse | null> {
    const dashboards = await this.listDashboards()
    return dashboards.find((d) => d.name === name && !d.deleted) || null
  }

  /**
   * Delete all dashboards in the project
   * @returns Number of dashboards deleted
   */
  async deleteAllDashboards(): Promise<number> {
    const dashboards = await this.listDashboards()
    const activeDashboards = dashboards.filter((d) => !d.deleted)

    for (const dashboard of activeDashboards) {
      await this.deleteDashboard(dashboard.id)
    }

    return activeDashboards.length
  }

  // ==========================================
  // Insight Operations
  // ==========================================

  /**
   * List insights in the project with pagination support
   * @param options Pagination and filter options
   * @returns Paginated response with results and next cursor
   */
  async listInsights(
    options: {
      limit?: number
      offset?: number
      deleted?: boolean
    } = {},
  ): Promise<{ results: InsightResponse[]; next: string | null; count: number }> {
    const { limit = 100, offset, deleted } = options
    const params = new URLSearchParams()
    params.set("limit", String(limit))
    if (offset !== undefined) params.set("offset", String(offset))
    if (deleted !== undefined) params.set("deleted", String(deleted))

    const response = await this.request<{ results: InsightResponse[]; next: string | null; count: number }>(
      "GET",
      `/api/projects/${this.projectId}/insights/?${params.toString()}`,
    )
    return response
  }

  /**
   * Get a single insight by ID
   */
  async getInsight(insightId: number): Promise<InsightResponse> {
    return this.request<InsightResponse>("GET", `/api/projects/${this.projectId}/insights/${insightId}/`)
  }

  /**
   * Create an insight from definition
   * Supports both legacy filters format and newer query format
   * Use query format for funnels with Actions (OR logic between events)
   */
  async createInsightWithFilters(insight: InsightDefinition, dashboardId?: number): Promise<InsightResponse> {
    const payload: Record<string, unknown> = {
      name: insight.name,
      description: insight.description,
    }

    // Use query format if provided, otherwise use filters
    if (insight.query) {
      payload.query = insight.query
    } else if (insight.filters) {
      payload.filters = insight.filters
    }

    if (dashboardId) {
      payload.dashboards = [dashboardId]
    }

    return this.request<InsightResponse>("POST", `/api/projects/${this.projectId}/insights/`, payload)
  }

  /**
   * Create an insight with query-based configuration (newer approach)
   */
  async createInsightWithQuery(
    name: string,
    description: string | undefined,
    filters: Filter,
    dashboardId?: number,
  ): Promise<InsightResponse> {
    // Convert filters to query format based on insight type
    const query = this.filtersToQuery(filters)

    const payload: Record<string, unknown> = {
      name,
      description,
      query,
    }

    if (dashboardId) {
      payload.dashboards = [dashboardId]
    }

    return this.request<InsightResponse>("POST", `/api/projects/${this.projectId}/insights/`, payload)
  }

  /**
   * Convert legacy filters to query format
   */
  private filtersToQuery(filters: Filter): Record<string, unknown> {
    const insightType = filters.insight || "TRENDS"

    // Base query structure
    const baseQuery = {
      kind: "InsightVizNode",
      source: {
        kind: this.getQueryKind(insightType),
        dateRange: filters.date_from
          ? {
              date_from: filters.date_from,
              date_to: filters.date_to,
            }
          : undefined,
        interval: filters.interval,
        breakdownFilter: filters.breakdown
          ? {
              breakdown_type: filters.breakdown_type || "event",
              breakdown: filters.breakdown,
              breakdown_normalize_url: filters.breakdown_normalize_url,
            }
          : undefined,
        compareFilter: filters.compare
          ? {
              compare: filters.compare,
              compare_to: filters.compare_to,
            }
          : undefined,
        series: this.eventsToSeries(filters.events || []),
        ...(filters.formula ? { formula: filters.formula } : {}),
      },
      ...(filters.display
        ? {
            vizSpecificOptions: {
              display: filters.display,
            },
          }
        : {}),
    }

    // Add funnel-specific options
    if (insightType === "FUNNELS") {
      Object.assign(baseQuery.source, {
        funnelWindowInterval: filters.funnel_window_interval,
        funnelWindowIntervalUnit: filters.funnel_window_interval_unit,
        funnelVizType: filters.funnel_viz_type,
        funnelOrderType: filters.funnel_order_type,
      })
    }

    // Add retention-specific options
    if (insightType === "RETENTION") {
      Object.assign(baseQuery.source, {
        retentionType: filters.retention_type,
        totalIntervals: filters.total_intervals,
        period: filters.period,
        targetEntity: filters.target_entity,
        returningEntity: filters.returning_entity,
      })
    }

    return baseQuery
  }

  /**
   * Get query kind from insight type
   */
  private getQueryKind(insightType: string): string {
    const kindMap: Record<string, string> = {
      TRENDS: "TrendsQuery",
      FUNNELS: "FunnelsQuery",
      RETENTION: "RetentionQuery",
      PATHS: "PathsQuery",
      STICKINESS: "StickinessQuery",
      LIFECYCLE: "LifecycleQuery",
    }
    return kindMap[insightType] || "TrendsQuery"
  }

  /**
   * Convert events to series format
   */
  private eventsToSeries(events: Event[]): Array<Record<string, unknown>> {
    return events.map((event) => ({
      kind: "EventsNode",
      event: event.id,
      name: event.name || event.id,
      math: event.math || "total",
      math_property: event.math_property,
      math_hogql: event.math_hogql,
      properties: event.properties?.map((p) => ({
        key: p.key,
        value: p.value,
        operator: p.operator || "exact",
        type: p.type || "event",
      })),
    }))
  }

  /**
   * Delete an insight (soft delete via PATCH)
   */
  async deleteInsight(insightId: number): Promise<void> {
    await this.request<void>("PATCH", `/api/projects/${this.projectId}/insights/${insightId}/`, {
      deleted: true,
    })
  }

  /**
   * Delete all insights in the project (handles pagination)
   * Uses deleted=false filter to only fetch active insights, avoiding the issue
   * where pages of soft-deleted insights could cause early termination.
   * @returns Number of insights deleted
   */
  async deleteAllInsights(): Promise<number> {
    let totalDeleted = 0

    // Keep fetching and deleting until no more active insights exist
    // We always fetch from offset 0 because deleting insights shifts the list
    while (true) {
      // Fetch only non-deleted insights to avoid pagination issues with soft-deleted items
      const { results: activeInsights } = await this.listInsights({ limit: 100, deleted: false })

      if (activeInsights.length === 0) {
        break
      }

      for (const insight of activeInsights) {
        await this.deleteInsight(insight.id)
        totalDeleted++
      }

      console.log(`Deleted ${totalDeleted} insights so far...`)
    }

    return totalDeleted
  }

  // ==========================================
  // Dashboard Tile Operations
  // Note: PostHog doesn't have a dedicated /tiles/ endpoint.
  // Tiles are managed via dashboard PATCH or by creating insights with dashboards=[id]
  // ==========================================

  /**
   * Add a text tile to a dashboard via PATCH
   * Retrieves current tiles and appends the new text tile
   */
  async addTextTile(
    dashboardId: number,
    text: string,
    layouts?: Record<string, { h: number; w: number; x: number; y: number }>,
  ): Promise<DashboardTileResponse> {
    // Get current dashboard to retrieve existing tiles
    const dashboard = await this.request<{ tiles: DashboardTileResponse[] }>(
      "GET",
      `/api/projects/${this.projectId}/dashboards/${dashboardId}/`,
    )

    // Create new text tile object
    const newTile = {
      text: { body: text },
      layouts: layouts || {},
    }

    // Update dashboard with the new tile appended
    const updated = await this.request<{ tiles: DashboardTileResponse[] }>(
      "PATCH",
      `/api/projects/${this.projectId}/dashboards/${dashboardId}/`,
      {
        tiles: [...(dashboard.tiles || []), newTile],
      },
    )

    // Return the last tile (the one we just added)
    const tiles = updated.tiles || []
    return (
      tiles[tiles.length - 1] ||
      ({ id: 0, dashboard_id: dashboardId, insight_id: null, text, layouts: layouts || {} } as DashboardTileResponse)
    )
  }

  /**
   * Update insight layouts on a dashboard
   * When an insight is created with dashboards=[id], PostHog automatically creates a tile.
   * This method can be used to update the layout of that tile.
   */
  async updateInsightLayout(
    dashboardId: number,
    insightId: number,
    layouts: Record<string, { h: number; w: number; x: number; y: number }>,
  ): Promise<void> {
    // Get current dashboard tiles
    // Note: PostHog API returns insight as an object { id, name, ... }, not just a number
    const dashboard = await this.request<{
      tiles: Array<{
        id: number
        insight: { id: number } | null
        layouts: Record<string, unknown>
      }>
    }>("GET", `/api/projects/${this.projectId}/dashboards/${dashboardId}/`)

    // Find the tile for this insight and update its layout
    const updatedTiles = (dashboard.tiles || []).map((tile) => {
      // Compare insight.id since insight is an object, not a number
      if (tile.insight?.id === insightId) {
        return { ...tile, layouts }
      }
      return tile
    })

    // Update the dashboard with modified tiles
    await this.request("PATCH", `/api/projects/${this.projectId}/dashboards/${dashboardId}/`, { tiles: updatedTiles })
  }

  // ==========================================
  // Cohort Operations
  // ==========================================

  /**
   * List all cohorts in the project
   */
  async listCohorts(): Promise<CohortResponse[]> {
    const response = await this.request<{ results: CohortResponse[] }>(
      "GET",
      `/api/projects/${this.projectId}/cohorts/`,
    )
    return response.results
  }

  /**
   * Create a cohort
   */
  async createCohort(cohort: CohortDefinition): Promise<CohortResponse> {
    // Convert cohort definition to API format
    const filters = {
      properties: {
        type: "OR",
        values: cohort.groups.map((group) => ({
          type: "AND",
          values: group.properties.map((prop) => ({
            key: prop.key,
            type: prop.type || "person",
            value: prop.value,
            operator: prop.operator || "exact",
            ...(prop.event_type ? { event_type: prop.event_type } : {}),
            ...(prop.time_value ? { time_value: prop.time_value } : {}),
            ...(prop.time_interval ? { time_interval: prop.time_interval } : {}),
          })),
        })),
      },
    }

    return this.request<CohortResponse>("POST", `/api/projects/${this.projectId}/cohorts/`, {
      name: cohort.name,
      description: cohort.description,
      filters,
      is_static: cohort.is_static || false,
    })
  }

  /**
   * Find a cohort by name
   */
  async findCohortByName(name: string): Promise<CohortResponse | null> {
    const cohorts = await this.listCohorts()
    return cohorts.find((c) => c.name === name && !c.deleted) || null
  }

  /**
   * Delete a cohort (soft delete via PATCH)
   */
  async deleteCohort(cohortId: number): Promise<void> {
    await this.request<void>("PATCH", `/api/projects/${this.projectId}/cohorts/${cohortId}/`, {
      deleted: true,
    })
  }

  /**
   * Delete all cohorts in the project
   * @returns Number of cohorts deleted
   */
  async deleteAllCohorts(): Promise<number> {
    const cohorts = await this.listCohorts()
    const activeCohorts = cohorts.filter((c) => !c.deleted)

    for (const cohort of activeCohorts) {
      await this.deleteCohort(cohort.id)
    }

    return activeCohorts.length
  }

  // ==========================================
  // Action Operations
  // Actions combine multiple events with OR logic
  // ==========================================

  /**
   * List all actions in the project
   */
  async listActions(): Promise<ActionResponse[]> {
    const response = await this.request<{ results: ActionResponse[] }>(
      "GET",
      `/api/projects/${this.projectId}/actions/`,
    )
    return response.results
  }

  /**
   * Create an action
   * Actions combine multiple events with OR logic - any matching step triggers the action
   */
  async createAction(action: ActionDefinition): Promise<ActionResponse> {
    return this.request<ActionResponse>("POST", `/api/projects/${this.projectId}/actions/`, {
      name: action.name,
      description: action.description,
      steps: action.steps.map((step) => ({
        event: step.event,
        properties: step.properties || null,
      })),
      tags: action.tags || [],
    })
  }

  /**
   * Find an action by name
   */
  async findActionByName(name: string): Promise<ActionResponse | null> {
    const actions = await this.listActions()
    return actions.find((a) => a.name === name && !a.deleted) || null
  }

  /**
   * Delete an action
   */
  async deleteAction(actionId: number): Promise<void> {
    await this.request<void>("DELETE", `/api/projects/${this.projectId}/actions/${actionId}/`)
  }

  /**
   * Delete all actions in the project
   * @returns Number of actions deleted
   */
  async deleteAllActions(): Promise<number> {
    const actions = await this.listActions()
    const activeActions = actions.filter((a) => !a.deleted)

    for (const action of activeActions) {
      await this.deleteAction(action.id)
    }

    return activeActions.length
  }

  /**
   * Get or create an action by name
   * Returns existing action if found, creates new one otherwise
   */
  async getOrCreateAction(action: ActionDefinition): Promise<ActionResponse> {
    const existing = await this.findActionByName(action.name)
    if (existing) {
      return existing
    }
    return this.createAction(action)
  }

  // ==========================================
  // High-Level Operations
  // ==========================================

  /**
   * Create a complete dashboard with all tiles
   *
   * Tile creation approach:
   * - Insights: Created with dashboards=[id], which auto-creates tiles. Layouts updated via PATCH.
   * - Text tiles: Added via dashboard PATCH to the tiles array.
   */
  async createCompleteDashboard(
    definition: DashboardDefinition,
    options: { skipExisting?: boolean; replaceExisting?: boolean } = {},
  ): Promise<{
    dashboard: DashboardResponse
    insights: InsightResponse[]
    textTiles: DashboardTileResponse[]
    replaced: boolean
  }> {
    let replaced = false

    // Check if dashboard already exists
    const existing = await this.findDashboardByName(definition.name)

    if (existing) {
      if (options.skipExisting) {
        console.log(`Dashboard "${definition.name}" already exists, skipping`)
        return {
          dashboard: existing,
          insights: [],
          textTiles: [],
          replaced: false,
        }
      }

      if (options.replaceExisting) {
        console.log(`Dashboard "${definition.name}" exists, replacing...`)
        const { insightsDeleted } = await this.deleteDashboardWithInsights(existing.id)
        console.log(`Deleted ${insightsDeleted} old insights`)
        replaced = true
      }
    }

    // Create the dashboard
    const dashboard = await this.createDashboard(definition.name, definition.description, definition.tags)

    const insights: InsightResponse[] = []
    const textTiles: DashboardTileResponse[] = []

    // Track insights that need layout updates
    const layoutUpdates: Array<{
      insightId: number
      layouts: Record<string, { h: number; w: number; x: number; y: number }>
    }> = []

    // Create tiles
    for (const tile of definition.tiles) {
      if (tile.type === "text") {
        // Add text tile via dashboard PATCH
        const textTile = await this.addTextTile(dashboard.id, tile.body, tile.layouts)
        textTiles.push(textTile)
      } else if (tile.type === "insight") {
        // Create insight with dashboards=[id] - this auto-creates a tile
        const insight = await this.createInsightWithFilters(tile.insight, dashboard.id)
        insights.push(insight)

        // Queue layout update if specified
        if (tile.layouts) {
          layoutUpdates.push({ insightId: insight.id, layouts: tile.layouts })
        }
      }
    }

    // Apply layout updates for insights
    for (const { insightId, layouts } of layoutUpdates) {
      await this.updateInsightLayout(dashboard.id, insightId, layouts)
    }

    return { dashboard, insights, textTiles, replaced }
  }

  /**
   * Create all cohorts
   */
  async createAllCohorts(
    cohorts: CohortDefinition[],
    options: { skipExisting?: boolean } = {},
  ): Promise<CohortResponse[]> {
    const results: CohortResponse[] = []

    for (const cohort of cohorts) {
      if (options.skipExisting) {
        const existing = await this.findCohortByName(cohort.name)
        if (existing) {
          console.log(`Cohort "${cohort.name}" already exists, skipping`)
          results.push(existing)
          continue
        }
      }

      const created = await this.createCohort(cohort)
      results.push(created)
    }

    return results
  }

  /**
   * Get the project ID
   */
  getProjectId(): string {
    return this.projectId
  }

  /**
   * Health check - verify API connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.listDashboards()
      return true
    } catch {
      return false
    }
  }

  // ==========================================
  // Events Query Operations
  // ==========================================

  /**
   * Query events from the PostHog events API
   * @param options Query options
   * @returns Array of events
   */
  async queryEvents(
    options: {
      /** Filter events after this ISO timestamp */
      after?: string
      /** Filter events before this ISO timestamp */
      before?: string
      /** Filter by event name */
      event?: string
      /** Maximum number of events to return (handles pagination) */
      limit?: number
    } = {},
  ): Promise<PostHogEvent[]> {
    const { after, before, event, limit = 1000 } = options
    const allEvents: PostHogEvent[] = []
    let cursor: string | null = null
    const pageSize = Math.min(limit, 100) // PostHog max per page is 100

    do {
      // Build query params
      const params = new URLSearchParams()
      if (after) params.set("after", after)
      if (before) params.set("before", before)
      if (event) params.set("event", event)
      params.set("limit", String(pageSize))

      // Build the URL with cursor if we have one
      let endpoint = `/api/projects/${this.projectId}/events/?${params.toString()}`
      if (cursor) {
        // PostHog returns full URL in next, we need just the path
        const cursorUrl = new URL(cursor)
        endpoint = cursorUrl.pathname + cursorUrl.search
      }

      const response = await this.request<PaginatedEventsResponse>("GET", endpoint)
      allEvents.push(...response.results)
      cursor = response.next

      // Stop if we've reached the limit
      if (allEvents.length >= limit) {
        break
      }
    } while (cursor)

    return allEvents.slice(0, limit)
  }

  /**
   * Query events from the last N hours
   * @param hours Number of hours to look back
   * @param options Additional query options
   * @returns Array of events
   */
  async queryRecentEvents(hours: number, options: { event?: string; limit?: number } = {}): Promise<PostHogEvent[]> {
    const after = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    return this.queryEvents({ after, ...options })
  }
}

/**
 * Create a PostHog API client from environment variables
 */
export function createPostHogClient(env?: Partial<Env>): PostHogApiClient {
  return new PostHogApiClient(env)
}
