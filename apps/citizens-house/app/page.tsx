import { Suspense } from "react"
import { redirect } from "next/navigation"
import { appMode, maintenanceMode } from "@/flags"

async function HomeRedirect(): Promise<null> {
  const destination = await getHomeDestination()
  redirect(destination)
  return null
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeRedirect />
    </Suspense>
  )
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
