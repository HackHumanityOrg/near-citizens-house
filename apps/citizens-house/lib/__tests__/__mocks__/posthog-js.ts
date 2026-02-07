/**
 * Mock for posthog-js in vitest tests.
 *
 * This prevents tests from accidentally sending real analytics events
 * to PostHog. All methods are no-ops that return safe default values.
 */
const posthog = {
  init: () => {},
  capture: () => {},
  identify: () => {},
  reset: () => {},
  opt_in_capturing: () => {},
  opt_out_capturing: () => {},
  has_opted_in_capturing: () => false,
  has_opted_out_capturing: () => false,
  get_distinct_id: () => "test-user",
  register: () => {},
  unregister: () => {},
}

export default posthog
