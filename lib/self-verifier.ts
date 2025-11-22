import { SelfBackendVerifier, type VerificationConfig } from "@selfxyz/core"
import { SELF_CONFIG } from "@/lib/config"

export class InMemoryConfigStore {
  private config: VerificationConfig

  constructor(config: VerificationConfig) {
    this.config = config
  }

  async getConfig(_configId: string) {
    return this.config
  }

  async setConfig(_configId: string, config: VerificationConfig) {
    this.config = config
    return true
  }

  async getActionId(_userIdentifier: string, _userDefinedData?: string) {
    return "default"
  }
}

// Attestation types: 1=Passport, 2=BiometricIDCard, 3=Aadhaar
const AllowedAttestationIds = new Map<1 | 2 | 3, boolean>([[1, true]])

let selfBackendVerifier: SelfBackendVerifier | null = null

export function getVerifier() {
  if (!selfBackendVerifier) {
    selfBackendVerifier = new SelfBackendVerifier(
      SELF_CONFIG.scope,
      SELF_CONFIG.endpoint,
      false,
      AllowedAttestationIds,
      new InMemoryConfigStore(SELF_CONFIG.backendConfig),
      "uuid",
    )
  }
  return selfBackendVerifier
}
