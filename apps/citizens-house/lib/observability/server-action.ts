"use server"

import * as Sentry from "@sentry/nextjs"

export async function withObservedServerAction<T>(actionName: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.withServerActionInstrumentation(
    actionName,
    {
      recordResponse: false,
    },
    fn,
  )
}
