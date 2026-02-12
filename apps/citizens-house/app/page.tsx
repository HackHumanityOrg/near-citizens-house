import { redirect } from "next/navigation"
import { appMode, maintenanceMode } from "@/flags"

export default async function HomePage() {
  try {
    if (await maintenanceMode()) {
      redirect("/maintenance")
    }

    const mode = await appMode()

    if (mode === "voting") {
      redirect("/governance")
    }

    if (mode === "waiting") {
      redirect("/waiting")
    }

    redirect("/verification")
  } catch {
    redirect("/maintenance")
  }
}
