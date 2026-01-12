"use client"

/**
 * Client-Side Wide Event Logger
 *
 * Uses PostHog's capture API to send structured log events from the browser.
 * This complements the server-side OpenTelemetry logger.
 *
 * Note: PostHog session recording already captures console.log output,
 * but this provides structured data for analytics and searching.
 */

import posthog from "posthog-js"
import { LogScope, type LogOperation } from "./logging"

// Service metadata
const SERVICE_NAME = "citizens-house"
const DEPLOYMENT_ENV = process.env.NODE_ENV || "development"

export type ClientLogLevel = "debug" | "info" | "warn" | "error"

/**
 * Client-side log attributes
 */
export interface ClientLogAttributes {
  // Operation context
  operation?: LogOperation
  scope?: LogScope
  component?: string

  // User context
  account_id?: string
  session_id?: string

  // Error context
  error_type?: string
  error_code?: string
  error_message?: string

  // Custom attributes
  [key: string]: unknown
}

/**
 * Log a client-side event to PostHog
 */
function log(level: ClientLogLevel, message: string, attributes: ClientLogAttributes = {}): void {
  // Skip debug logs in production
  if (level === "debug" && DEPLOYMENT_ENV === "production") {
    return
  }

  const eventName = `log_${level}`

  const properties = {
    log_message: message,
    log_level: level,
    "service.name": SERVICE_NAME,
    "deployment.environment": DEPLOYMENT_ENV,
    timestamp: new Date().toISOString(),
    ...attributes,
  }

  // Send to PostHog
  posthog.capture(eventName, properties)

  // Also log to console in development
  if (DEPLOYMENT_ENV === "development") {
    const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "log"

    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, properties)
  }
}

/**
 * Client-side logger instance
 */
export const clientLogger = {
  debug: (message: string, attributes?: ClientLogAttributes) => log("debug", message, attributes),
  info: (message: string, attributes?: ClientLogAttributes) => log("info", message, attributes),
  warn: (message: string, attributes?: ClientLogAttributes) => log("warn", message, attributes),
  error: (message: string, attributes?: ClientLogAttributes) => log("error", message, attributes),

  /**
   * Log an error with full context extraction
   */
  exception: (error: Error, attributes?: ClientLogAttributes) => {
    log("error", error.message, {
      ...attributes,
      error_type: error.name,
      error_message: error.message,
      error_stack: error.stack,
    })
  },
}

/**
 * Client-side wide event builder
 */
export class ClientWideEvent {
  private operation: LogOperation
  private attributes: ClientLogAttributes = {}
  private startTime: number

  constructor(operation: LogOperation) {
    this.operation = operation
    this.startTime = Date.now()
    this.attributes.operation = operation
  }

  /**
   * Set component context
   */
  setComponent(component: string): this {
    this.attributes.component = component
    return this
  }

  /**
   * Set user context
   */
  setUser(ctx: { account_id?: string; session_id?: string }): this {
    if (ctx.account_id) this.attributes.account_id = ctx.account_id
    if (ctx.session_id) this.attributes.session_id = ctx.session_id
    return this
  }

  /**
   * Set error context
   */
  setError(error: Error | { code?: string; message?: string }): this {
    if (error instanceof Error) {
      this.attributes.error_type = error.name
      this.attributes.error_message = error.message
    } else {
      if (error.code) this.attributes.error_code = error.code
      if (error.message) this.attributes.error_message = error.message
    }
    return this
  }

  /**
   * Set custom attribute
   */
  set(key: string, value: unknown): this {
    this.attributes[key] = value
    return this
  }

  /**
   * Emit the wide event log
   */
  emit(level: ClientLogLevel, message: string): void {
    this.attributes.duration_ms = Date.now() - this.startTime
    log(level, message, this.attributes)
  }

  info(message: string): void {
    this.emit("info", message)
  }

  error(message: string): void {
    this.emit("error", message)
  }

  warn(message: string): void {
    this.emit("warn", message)
  }
}

/**
 * Create a client-side wide event
 */
export function createClientEvent(operation: LogOperation): ClientWideEvent {
  return new ClientWideEvent(operation)
}
