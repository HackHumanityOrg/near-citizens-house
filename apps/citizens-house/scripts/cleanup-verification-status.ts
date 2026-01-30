/**
 * Cleanup Verification Status Keys
 *
 * Removes legacy verification status records from Redis.
 *
 * Usage:
 *   pnpm exec tsx scripts/cleanup-verification-status.ts
 *   pnpm exec tsx scripts/cleanup-verification-status.ts --dry-run
 */
import { getRedisClient } from "../lib/redis"

const REDIS_KEY_PREFIX = "verification:status:"
const SCAN_BATCH_SIZE = 100

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  const redis = await getRedisClient()

  let scanned = 0
  let deleted = 0
  for await (const key of redis.scanIterator({ MATCH: `${REDIS_KEY_PREFIX}*`, COUNT: SCAN_BATCH_SIZE })) {
    scanned++
    if (dryRun) {
      console.log(`Would delete: ${key}`)
      continue
    }

    deleted += await redis.del(key)
  }

  if (dryRun) {
    console.log(`\nScanned ${scanned} keys.`)
    console.log("Dry run complete. No keys deleted.")
  } else {
    console.log(`\nScanned ${scanned} keys.`)
    console.log(`Deleted ${deleted} keys with prefix '${REDIS_KEY_PREFIX}'.`)
  }

  await redis.quit()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
