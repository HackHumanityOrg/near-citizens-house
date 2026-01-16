import { initBotId } from "botid/client/core"

// Initialize BotID for client-side bot protection
// Protected routes must match the checkBotId() calls on the server
initBotId({
  protect: [
    {
      // Main verification endpoint - protects against automated passport proof submissions
      path: "/api/verification/verify",
      method: "POST",
    },
  ],
})
