// Cryptographic utilities for Discourse User API Keys authentication
// Uses node-forge because Discourse requires RSA-PKCS#1 v1.5 padding
// which Web Crypto API doesn't support

import forge from "node-forge"
import type { KeyPair, DecryptedPayload } from "./types"

export type { KeyPair, DecryptedPayload }

/**
 * Generate a 2048-bit RSA keypair for Discourse authentication
 */
export function generateKeyPair(): KeyPair {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 })

  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey)
  const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey)

  return { privateKeyPem, publicKeyPem }
}

/**
 * Decrypt the encrypted payload from Discourse callback
 * Discourse encrypts with RSA-PKCS#1 v1.5
 */
export function decryptPayload(encryptedBase64: string, privateKeyPem: string): DecryptedPayload {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)

  // Decode base64 to get encrypted bytes
  const encryptedBytes = forge.util.decode64(encryptedBase64)

  // Decrypt with RSA-PKCS#1 v1.5
  const decrypted = privateKey.decrypt(encryptedBytes, "RSAES-PKCS1-V1_5")

  // Parse JSON payload
  const payload = JSON.parse(decrypted) as DecryptedPayload

  return payload
}

/**
 * Generate a random nonce for CSRF protection
 */
export function generateNonce(): string {
  const bytes = forge.random.getBytesSync(16)
  return forge.util.bytesToHex(bytes)
}

/**
 * Generate a unique client ID for the application
 */
export function generateClientId(): string {
  const bytes = forge.random.getBytesSync(16)
  return forge.util.bytesToHex(bytes)
}

/**
 * Build the Discourse authorization URL
 */
export function buildAuthUrl(
  discourseUrl: string,
  params: {
    applicationName: string
    clientId: string
    scopes: string
    publicKeyPem: string
    nonce: string
    authRedirect: string
  },
): string {
  const url = new URL("/user-api-key/new", discourseUrl)

  url.searchParams.set("application_name", params.applicationName)
  url.searchParams.set("client_id", params.clientId)
  url.searchParams.set("scopes", params.scopes)
  url.searchParams.set("public_key", params.publicKeyPem)
  url.searchParams.set("nonce", params.nonce)
  url.searchParams.set("auth_redirect", params.authRedirect)

  return url.toString()
}
