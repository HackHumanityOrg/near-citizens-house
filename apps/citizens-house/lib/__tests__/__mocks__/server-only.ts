/**
 * Mock for server-only package in vitest tests.
 *
 * The real server-only package throws an error when imported outside
 * of React Server Components. This mock is a no-op to allow testing
 * server-side code in vitest.
 */
export {}
