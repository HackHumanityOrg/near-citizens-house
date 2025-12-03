import { NextResponse } from "next/server"
import { z } from "zod"

const requestSchema = z.object({
  discourseUrl: z.string().url(),
  apiKey: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { discourseUrl, apiKey } = requestSchema.parse(body)

    // Fetch current session info from Discourse
    const sessionResponse = await fetch(`${discourseUrl}/session/current.json`, {
      headers: {
        "User-Api-Key": apiKey,
        Accept: "application/json",
      },
    })

    if (!sessionResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Discourse session", status: sessionResponse.status },
        { status: sessionResponse.status },
      )
    }

    const sessionData = await sessionResponse.json()

    if (!sessionData.current_user) {
      return NextResponse.json({ error: "Not authenticated with Discourse" }, { status: 401 })
    }

    const user = sessionData.current_user

    // Construct avatar URL
    let avatarUrl = user.avatar_template || ""
    if (avatarUrl && !avatarUrl.startsWith("http")) {
      // Avatar template contains {size} placeholder
      avatarUrl = avatarUrl.replace("{size}", "120")
      avatarUrl = `${discourseUrl}${avatarUrl}`
    }

    return NextResponse.json({
      username: user.username,
      email: user.email || null,
      avatar_url: avatarUrl,
      trust_level: user.trust_level ?? 0,
      name: user.name || null,
    })
  } catch (error) {
    console.error("Discourse profile fetch error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request parameters", details: error.issues }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
