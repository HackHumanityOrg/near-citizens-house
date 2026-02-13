import { epochMsToNanoseconds, parseDatetimeLocalToEpochMs } from "./governance-dates"
import { nearToYocto, yoctoToNear } from "./schemas/governance-contract"

const MAX_TITLE_BYTES = 140
const MAX_AUTHOR_BYTES = 120
const MAX_DESCRIPTION_BYTES = 10_000
const MAX_BOND_DECIMALS = 24
const BOND_NEAR_PATTERN = /^\d+(?:\.\d+)?$/

export interface CreateProposalValidationInput {
  title: string
  author: string
  description: string
  scheduled: boolean
  startAt: string
  bondNear: string
  minProposalBondYocto: string
  maxStartDelaySecs: number
  nowMs: number
}

export interface CreateProposalValidationErrors {
  title?: string
  author?: string
  description?: string
  startAt?: string
  bondNear?: string
}

export interface CreateProposalNormalizedInput {
  title: string
  author: string
  description: string
  bondYocto: string
  startAtNs?: string
}

export interface CreateProposalValidationResult {
  isValid: boolean
  errors: CreateProposalValidationErrors
  normalized?: CreateProposalNormalizedInput
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function formatSecondsDuration(seconds: number): string {
  if (seconds % 86_400 === 0) {
    const days = seconds / 86_400
    return `${days} day${days === 1 ? "" : "s"}`
  }
  if (seconds % 3_600 === 0) {
    const hours = seconds / 3_600
    return `${hours} hour${hours === 1 ? "" : "s"}`
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60
    return `${minutes} minute${minutes === 1 ? "" : "s"}`
  }
  return `${seconds} second${seconds === 1 ? "" : "s"}`
}

export function firstCreateProposalValidationError(errors: CreateProposalValidationErrors): string | null {
  return errors.title ?? errors.author ?? errors.description ?? errors.startAt ?? errors.bondNear ?? null
}

export function validateCreateProposalInput(input: CreateProposalValidationInput): CreateProposalValidationResult {
  const errors: CreateProposalValidationErrors = {}

  const title = input.title.trim()
  const author = input.author.trim()
  const description = input.description.trim()
  const bondNear = input.bondNear.trim()
  const maxStartDelaySecs = Math.max(0, Math.floor(input.maxStartDelaySecs))

  if (!title) {
    errors.title = "Title is required."
  } else if (utf8ByteLength(title) > MAX_TITLE_BYTES) {
    errors.title = `Title must be ${MAX_TITLE_BYTES} bytes or less.`
  }

  if (!author) {
    errors.author = "Author is required."
  } else if (utf8ByteLength(author) > MAX_AUTHOR_BYTES) {
    errors.author = `Author must be ${MAX_AUTHOR_BYTES} bytes or less.`
  }

  if (!description) {
    errors.description = "Description is required."
  } else if (utf8ByteLength(description) > MAX_DESCRIPTION_BYTES) {
    errors.description = `Description must be ${MAX_DESCRIPTION_BYTES} bytes or less.`
  }

  let startAtNs: string | undefined
  if (input.scheduled) {
    if (!input.startAt) {
      errors.startAt = "Please choose a voting start date and time."
    } else {
      const startMs = parseDatetimeLocalToEpochMs(input.startAt)
      if (startMs === null) {
        errors.startAt = "Invalid voting start date and time."
      } else if (startMs < input.nowMs) {
        errors.startAt = "Voting start time must be in the future (UTC)."
      } else {
        const maxStartMs = input.nowMs + maxStartDelaySecs * 1000
        if (startMs > maxStartMs) {
          errors.startAt = `Voting start time must be within ${formatSecondsDuration(maxStartDelaySecs)} from now.`
        } else {
          startAtNs = epochMsToNanoseconds(startMs)
        }
      }
    }
  }

  let bondYocto: string = input.minProposalBondYocto
  try {
    const minBondYocto = BigInt(input.minProposalBondYocto)

    if (!bondNear) {
      errors.bondNear = `Bond is required (minimum ${yoctoToNear(input.minProposalBondYocto)} NEAR).`
    } else if (!BOND_NEAR_PATTERN.test(bondNear)) {
      errors.bondNear = "Bond must be a valid NEAR amount."
    } else {
      const decimals = bondNear.includes(".") ? bondNear.split(".")[1].length : 0
      if (decimals > MAX_BOND_DECIMALS) {
        errors.bondNear = `Bond supports up to ${MAX_BOND_DECIMALS} decimal places.`
      } else {
        bondYocto = nearToYocto(bondNear)
        if (BigInt(bondYocto) < minBondYocto) {
          errors.bondNear = `Bond must be at least ${yoctoToNear(input.minProposalBondYocto)} NEAR.`
        }
      }
    }
  } catch {
    errors.bondNear = "Invalid bond value."
  }

  const isValid = Object.values(errors).every((value) => value === undefined)
  if (!isValid) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    errors: {},
    normalized: {
      title,
      author,
      description,
      bondYocto,
      startAtNs,
    },
  }
}
