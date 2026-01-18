import type { AlertDefinition } from "./schemas"

/**
 * Alert definitions for monitoring critical metrics
 * These alerts notify the team when important thresholds are crossed
 *
 * Best Practices Applied:
 * - Pending periods prevent alert flapping from transient spikes
 * - Critical alerts have shorter pending periods (5 min) for faster response
 * - Warning alerts have longer pending periods (15 min) to reduce noise
 * - Runbook URLs link to response documentation
 */

// === Critical Alerts (Immediate Notification) ===

/**
 * Alert when verification completions drop significantly
 * Threshold: <50% of 7-day average
 */
export const verificationDropAlert: AlertDefinition = {
  name: "Verification Complete Drop",
  description: "Triggers when verification completions fall below 50% of the 7-day average",
  threshold: {
    configuration: {
      type: "relative",
      absoluteThreshold: {
        lower: 50, // Less than 50% of baseline
      },
    },
  },
  condition: {
    type: "relative_decrease",
  },
  pending_period_minutes: 5,
  runbook_url: "https://docs.example.com/runbooks/verification-drop",
  enabled: true,
}

/**
 * Alert when error rate spikes
 * Threshold: >3x hourly average
 */
export const errorSpikeAlert: AlertDefinition = {
  name: "Error Spike",
  description: "Triggers when error rate exceeds 3x the normal hourly average",
  threshold: {
    configuration: {
      type: "relative",
      absoluteThreshold: {
        upper: 300, // More than 3x (300%) of baseline
      },
    },
  },
  condition: {
    type: "relative_increase",
  },
  pending_period_minutes: 5,
  runbook_url: "https://docs.example.com/runbooks/error-spike",
  enabled: true,
}

/**
 * Alert when server rejections surge
 * Threshold: >5 rejections in 1 hour
 */
export const serverRejectionSurgeAlert: AlertDefinition = {
  name: "Server Rejection Surge",
  description: "Triggers when more than 5 server rejections occur within 1 hour",
  threshold: {
    configuration: {
      type: "absolute",
      absoluteThreshold: {
        upper: 5,
      },
    },
  },
  condition: {
    type: "absolute_value",
  },
  pending_period_minutes: 5,
  runbook_url: "https://docs.example.com/runbooks/server-rejection",
  enabled: true,
}

// === Warning Alerts (Daily Digest) ===

/**
 * Alert when conversion rate drops
 * Threshold: <80% of 30-day average
 */
export const conversionRateDropAlert: AlertDefinition = {
  name: "Conversion Rate Drop",
  description: "Triggers when conversion rate falls below 80% of the 30-day average",
  threshold: {
    configuration: {
      type: "relative",
      absoluteThreshold: {
        lower: 80, // Less than 80% of baseline
      },
    },
  },
  condition: {
    type: "relative_decrease",
  },
  pending_period_minutes: 15,
  runbook_url: "https://docs.example.com/runbooks/conversion-drop",
  enabled: true,
}

/**
 * Alert when mobile conversion falls
 * Threshold: <50% conversion rate
 */
export const mobileFailureRateAlert: AlertDefinition = {
  name: "Mobile Failure Rate",
  description: "Triggers when mobile conversion rate falls below 50%",
  threshold: {
    configuration: {
      type: "absolute",
      absoluteThreshold: {
        lower: 50, // Less than 50% conversion
      },
    },
  },
  condition: {
    type: "absolute_value",
  },
  pending_period_minutes: 15,
  runbook_url: "https://docs.example.com/runbooks/mobile-failure",
  enabled: true,
}

/**
 * Alert when wallet connect issues increase
 * Threshold: >20% failure rate
 */
export const walletConnectIssuesAlert: AlertDefinition = {
  name: "Wallet Connect Issues",
  description: "Triggers when wallet connection failure rate exceeds 20%",
  threshold: {
    configuration: {
      type: "absolute",
      absoluteThreshold: {
        upper: 20, // More than 20% failure rate
      },
    },
  },
  condition: {
    type: "absolute_value",
  },
  pending_period_minutes: 15,
  runbook_url: "https://docs.example.com/runbooks/wallet-connect",
  enabled: true,
}

/**
 * Alert when bounce rate increases
 * Threshold: >60% bounce rate
 */
export const bounceRateSpikeAlert: AlertDefinition = {
  name: "Bounce Rate Spike",
  description: "Triggers when bounce rate exceeds 60%",
  threshold: {
    configuration: {
      type: "absolute",
      absoluteThreshold: {
        upper: 60, // More than 60% bounce rate
      },
    },
  },
  condition: {
    type: "absolute_value",
  },
  pending_period_minutes: 15,
  runbook_url: "https://docs.example.com/runbooks/bounce-rate",
  enabled: true,
}

/**
 * Alert when LCP degrades
 * Threshold: >4000ms p75
 */
export const lcpDegradationAlert: AlertDefinition = {
  name: "LCP Degradation",
  description: "Triggers when LCP p75 exceeds 4000ms (Core Web Vitals 'Poor' threshold)",
  threshold: {
    configuration: {
      type: "absolute",
      absoluteThreshold: {
        upper: 4000, // More than 4000ms
      },
    },
  },
  condition: {
    type: "absolute_value",
  },
  pending_period_minutes: 15,
  runbook_url: "https://docs.example.com/runbooks/lcp-degradation",
  enabled: true,
}

/**
 * Alert when rage clicks increase
 * Threshold: >2x weekly average
 */
export const rageClickIncreaseAlert: AlertDefinition = {
  name: "Rage Click Increase",
  description: "Triggers when rage clicks exceed 2x the weekly average",
  threshold: {
    configuration: {
      type: "relative",
      absoluteThreshold: {
        upper: 200, // More than 2x (200%) of baseline
      },
    },
  },
  condition: {
    type: "relative_increase",
  },
  pending_period_minutes: 15,
  runbook_url: "https://docs.example.com/runbooks/rage-clicks",
  enabled: true,
}

/**
 * Alert when exception count is high
 * Threshold: >10 exceptions in 1 hour
 */
export const exceptionCountAlert: AlertDefinition = {
  name: "Exception Count High",
  description: "Triggers when more than 10 exceptions occur within 1 hour",
  threshold: {
    configuration: {
      type: "absolute",
      absoluteThreshold: {
        upper: 10,
      },
    },
  },
  condition: {
    type: "absolute_value",
  },
  pending_period_minutes: 10,
  runbook_url: "https://docs.example.com/runbooks/exception-count",
  enabled: true,
}

/**
 * Alert when exception rate spikes
 * Threshold: >3x normal rate
 */
export const exceptionSpikeAlert: AlertDefinition = {
  name: "Exception Spike",
  description: "Triggers when exception rate exceeds 3x the normal rate",
  threshold: {
    configuration: {
      type: "relative",
      absoluteThreshold: {
        upper: 300, // More than 3x (300%) of baseline
      },
    },
  },
  condition: {
    type: "relative_increase",
  },
  pending_period_minutes: 10,
  runbook_url: "https://docs.example.com/runbooks/exception-spike",
  enabled: true,
}

// === Export all alerts ===

/**
 * Critical alerts - should trigger immediate notification (Slack)
 */
export const criticalAlerts: AlertDefinition[] = [verificationDropAlert, errorSpikeAlert, serverRejectionSurgeAlert]

/**
 * Warning alerts - should be included in daily digest (Email)
 */
export const warningAlerts: AlertDefinition[] = [
  conversionRateDropAlert,
  mobileFailureRateAlert,
  walletConnectIssuesAlert,
  bounceRateSpikeAlert,
  lcpDegradationAlert,
  rageClickIncreaseAlert,
  exceptionCountAlert,
  exceptionSpikeAlert,
]

/**
 * All alerts combined
 */
export const allAlerts: AlertDefinition[] = [...criticalAlerts, ...warningAlerts]

export const alertNames = allAlerts.map((a) => a.name)
