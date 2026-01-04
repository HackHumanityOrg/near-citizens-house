/**
 * Feature flags for controlling feature visibility
 */
export const FEATURE_FLAGS = {
  /**
   * Governance feature - includes proposals, voting, and admin functionality
   * When disabled, all governance-related routes and UI elements are hidden
   */
  GOVERNANCE_ENABLED: false,
} as const

export type FeatureFlags = typeof FEATURE_FLAGS
