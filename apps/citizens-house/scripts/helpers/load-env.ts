import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"

/**
 * Loads the nearest `.env` file by walking up from process.cwd().
 * Returns the loaded path, or null if no file was found.
 */
export function loadNearestEnvFile(): string | null {
  let dir = process.cwd()

  while (true) {
    const envPath = path.join(dir, ".env")
    if (fs.existsSync(envPath)) {
      // Keep shell-exported env vars as source of truth.
      dotenv.config({ path: envPath, override: false })
      return envPath
    }

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return null
}
