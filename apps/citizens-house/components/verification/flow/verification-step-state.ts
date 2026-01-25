export const verificationStepStates = ["loading", "ready", "verifying", "polling", "success", "error"] as const

export type VerificationStepState = (typeof verificationStepStates)[number]
