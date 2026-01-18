#!/usr/bin/env npx tsx
/**
 * PostHog Dashboard Setup Script
 *
 * Creates the verification analytics dashboard in PostHog.
 *
 * Usage:
 *   npx tsx scripts/posthog-dashboards/setup.ts
 *   npx tsx scripts/posthog-dashboards/setup.ts --dry-run
 *   npx tsx scripts/posthog-dashboards/setup.ts clean
 *
 * Environment variables:
 *   POSTHOG_PERSONAL_API_KEY - Your PostHog Personal API Key
 *   POSTHOG_PROJECT_ID - Your PostHog Project ID
 */

import { createPostHogClient } from "./api-client"
import { allDashboards } from "./dashboards"
import { allActions } from "./actions"
import type { DashboardDefinition } from "./schemas"

// ANSI color codes for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(message: string, color?: keyof typeof colors): void {
  const colorCode = color ? colors[color] : ""
  console.log(`${colorCode}${message}${colors.reset}`)
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, "green")
}

function logError(message: string): void {
  log(`✗ ${message}`, "red")
}

function logInfo(message: string): void {
  log(`ℹ ${message}`, "cyan")
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, "yellow")
}

function logHeader(message: string): void {
  console.log()
  log(`═══ ${message} ═══`, "bright")
  console.log()
}

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; dryRun: boolean; skipExisting: boolean } {
  const args = process.argv.slice(2)
  const command = args.find((arg) => !arg.startsWith("-")) || "create"

  return {
    command,
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    skipExisting: args.includes("--skip-existing") || args.includes("-s"),
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
${colors.bright}PostHog Dashboard Setup Script${colors.reset}

${colors.cyan}Usage:${colors.reset}
  npx tsx scripts/posthog-dashboards/setup.ts [command] [options]

${colors.cyan}Commands:${colors.reset}
  create         Create the dashboard (default)
  clean          Delete all existing dashboards
  help           Show this help message

${colors.cyan}Options:${colors.reset}
  -d, --dry-run        Show what would be created without making changes
  -s, --skip-existing  Skip if dashboard already exists

${colors.cyan}Environment Variables:${colors.reset}
  POSTHOG_PERSONAL_API_KEY   Your PostHog Personal API Key (required)
  POSTHOG_PROJECT_ID         Your PostHog Project ID (required)
`)
}

/**
 * Verify API connection and environment
 */
async function verifySetup(): Promise<boolean> {
  logHeader("Verifying Setup")

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID

  if (!apiKey) {
    logError("POSTHOG_PERSONAL_API_KEY is not set")
    return false
  }
  logSuccess("POSTHOG_PERSONAL_API_KEY is set")

  if (!projectId) {
    logError("POSTHOG_PROJECT_ID is not set")
    return false
  }
  logSuccess(`POSTHOG_PROJECT_ID is set: ${projectId}`)

  logInfo("Testing API connection...")
  try {
    const client = createPostHogClient()
    const isHealthy = await client.healthCheck()

    if (isHealthy) {
      logSuccess("API connection successful")
      return true
    } else {
      logError("API connection failed")
      return false
    }
  } catch (error) {
    logError(`API connection error: ${error}`)
    return false
  }
}

/**
 * Replace action names with action IDs in a dashboard definition
 */
function resolveActionIds(dashboard: DashboardDefinition, actionMap: Map<string, number>): DashboardDefinition {
  return {
    ...dashboard,
    tiles: dashboard.tiles.map((tile) => {
      if (tile.type !== "insight") return tile

      const events = tile.insight.filters.events
      if (!events) return tile

      return {
        ...tile,
        insight: {
          ...tile.insight,
          filters: {
            ...tile.insight.filters,
            events: events.map((event) => {
              if (event.type === "actions" && typeof event.id === "string") {
                const actionId = actionMap.get(event.id)
                if (actionId) {
                  return { ...event, id: String(actionId) }
                }
              }
              return event
            }),
          },
        },
      }
    }),
  }
}

/**
 * Create dashboard
 */
async function createDashboard(options: { dryRun?: boolean; skipExisting?: boolean } = {}): Promise<void> {
  logHeader("Creating Dashboard")

  const { dryRun, skipExisting } = options
  const dashboard = allDashboards[0]

  if (dryRun) {
    logWarning("DRY RUN MODE - No changes will be made")
    console.log()
  }

  log(`\n${colors.blue}Dashboard: ${dashboard.name}${colors.reset}`)
  logInfo(`Description: ${dashboard.description || "N/A"}`)
  logInfo(`Tiles: ${dashboard.tiles.length}`)

  if (dryRun) {
    logInfo(`Would create ${allActions.length} actions:`)
    for (const action of allActions) {
      logInfo(`  - Action: ${action.name} (${action.steps.length} events with OR logic)`)
    }
    logInfo(`Would create dashboard with ${dashboard.tiles.length} tiles:`)
    for (const tile of dashboard.tiles) {
      if (tile.type === "text") {
        logInfo(`  - Text tile`)
      } else {
        logInfo(`  - Insight: ${tile.insight.name}`)
      }
    }
    return
  }

  try {
    const client = createPostHogClient()

    // Step 1: Create actions first (they combine events with OR logic)
    const actionMap = new Map<string, number>()
    if (allActions.length > 0) {
      log(`\n${colors.blue}Creating actions...${colors.reset}`)
      for (const action of allActions) {
        const created = await client.getOrCreateAction(action)
        actionMap.set(action.name, created.id)
        logSuccess(`Action: ${created.name} (ID: ${created.id})`)
      }
    }

    // Step 2: Resolve action names to IDs in the dashboard definition
    const resolvedDashboard = resolveActionIds(dashboard, actionMap)

    // Step 3: Create the dashboard with resolved action IDs
    const result = await client.createCompleteDashboard(resolvedDashboard, { skipExisting })

    logSuccess(`Created dashboard: ${result.dashboard.name} (ID: ${result.dashboard.id})`)
    logInfo(`  Created ${result.insights.length} insights`)
    logInfo(`  Created ${result.textTiles.length} text tiles`)
  } catch (error) {
    logError(`Failed to create dashboard: ${error}`)
  }

  console.log()
  logSuccess("Dashboard creation complete")
}

/**
 * Delete all existing dashboards
 */
async function cleanAll(options: { dryRun?: boolean } = {}): Promise<void> {
  logHeader("Cleaning Existing Dashboards")

  const { dryRun } = options

  if (dryRun) {
    logWarning("DRY RUN MODE - No changes will be made")
    console.log()
  }

  const client = createPostHogClient()

  log(`\n${colors.blue}Deleting dashboards...${colors.reset}`)
  const dashboards = await client.listDashboards()
  const activeDashboards = dashboards.filter((d) => !d.deleted)

  if (activeDashboards.length === 0) {
    logInfo("No dashboards to delete")
  } else {
    for (const dashboard of activeDashboards) {
      if (!dryRun) {
        await client.deleteDashboard(dashboard.id)
      }
    }
    if (dryRun) {
      logInfo(`Would delete ${activeDashboards.length} dashboards`)
    } else {
      logSuccess(`Deleted ${activeDashboards.length} dashboards`)
    }
  }

  console.log()
  logSuccess("Cleanup complete")
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, dryRun, skipExisting } = parseArgs()

  if (command === "help") {
    printHelp()
    return
  }

  switch (command) {
    case "clean":
      if (!(await verifySetup())) {
        process.exit(1)
      }
      await cleanAll({ dryRun })
      break

    case "create":
    default:
      if (!(await verifySetup())) {
        process.exit(1)
      }
      await createDashboard({ dryRun, skipExisting })
      break
  }
}

main().catch((error) => {
  logError(`Unexpected error: ${error}`)
  process.exit(1)
})
