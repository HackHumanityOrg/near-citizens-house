/**
 * Request Context for Logging
 *
 * Uses AsyncLocalStorage to propagate request context through async operations.
 * This allows the logger to automatically enrich logs with request-specific data.
 */
import { AsyncLocalStorage } from "async_hooks"

/**
 * Context data that gets automatically attached to all logs within a request.
 */
export interface RequestContext {
  /** Unique identifier for this request (UUID) */
  requestId: string
  /** OpenTelemetry trace ID for distributed tracing */
  traceId?: string
  /** OpenTelemetry span ID */
  spanId?: string
  /** Route path (e.g., "/api/verify") */
  route?: string
  /** NEAR account ID if user is authenticated */
  accountId?: string
  /** PostHog distinct ID for user correlation */
  distinctId?: string
}

/**
 * AsyncLocalStorage instance for request context.
 * This allows context to flow through async operations without explicit passing.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>()

/**
 * Run a function with request context.
 * All logs within the function will automatically include the context data.
 *
 * @example
 * ```ts
 * await withRequestContext(
 *   { requestId: crypto.randomUUID(), route: "/api/verify" },
 *   async () => {
 *     logger.info("verification", "start", { source: "button_click" }, "Started")
 *     // Log automatically includes requestId and route
 *   }
 * )
 * ```
 */
export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn)
}

/**
 * Get the current request context.
 * Returns undefined if called outside of a request context.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}

/**
 * Update the current request context with additional data.
 * Useful for adding user info after authentication.
 *
 * @example
 * ```ts
 * // After authenticating user
 * updateRequestContext({ accountId: "alice.near", distinctId: posthogId })
 * ```
 */
export function updateRequestContext(update: Partial<RequestContext>): void {
  const current = requestContext.getStore()
  if (current) {
    Object.assign(current, update)
  }
}
