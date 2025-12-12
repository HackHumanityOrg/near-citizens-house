// Simple in-memory session store for tracking verification status
// Sessions expire after 5 minutes

type SessionStatus = "pending" | "success" | "error"

interface Session {
  status: SessionStatus
  accountId?: string
  error?: string
  timestamp: number
}

const sessions = new Map<string, Session>()

// Session expiration time (5 minutes)
const SESSION_TTL_MS = 5 * 60 * 1000

// Clean up expired sessions periodically
function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [sessionId, session] of sessions) {
    if (now - session.timestamp > SESSION_TTL_MS) {
      sessions.delete(sessionId)
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredSessions, 60 * 1000)
}

export function createSession(sessionId: string): void {
  sessions.set(sessionId, {
    status: "pending",
    timestamp: Date.now(),
  })
}

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId)
  if (!session) return null

  // Check if expired
  if (Date.now() - session.timestamp > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    return null
  }

  return session
}

export function updateSession(
  sessionId: string,
  update: { status: SessionStatus; accountId?: string; error?: string }
): void {
  const session = sessions.get(sessionId)
  if (session) {
    sessions.set(sessionId, {
      ...session,
      ...update,
      timestamp: Date.now(),
    })
  } else {
    // Create session if it doesn't exist
    sessions.set(sessionId, {
      status: update.status,
      accountId: update.accountId,
      error: update.error,
      timestamp: Date.now(),
    })
  }
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId)
}
