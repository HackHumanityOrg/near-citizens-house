import { redirect } from "next/navigation"
import { appMode, maintenanceMode } from "@/flags"

export default async function HomePage() {
  const destination = await getHomeDestination()
  redirect(destination)
}

async function getHomeDestination(): Promise<string> {
  try {
    if (await maintenanceMode()) {
      return "/maintenance"
    }

    const mode = await appMode()

    if (mode === "voting") {
      return "/proposals"
    }

    if (mode === "waiting") {
      return "/waiting"
    }

    return "/verification"
  } catch {
    return "/maintenance"
  }
}
