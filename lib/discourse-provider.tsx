"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { DISCOURSE_CONFIG } from "./config"
import type { DiscourseProfile, DiscourseAuthState } from "./types"
import { generateKeyPair, generateNonce, generateClientId, buildAuthUrl, decryptPayload } from "./discourse-crypto"

interface DiscourseContextType {
  isConnected: boolean
  isLoading: boolean
  profile: DiscourseProfile | null
  connect: () => Promise<void>
  disconnect: () => void
  error: string | null
}

const DiscourseContext = createContext<DiscourseContextType | null>(null)

export function DiscourseProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DiscourseProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load saved profile from localStorage on mount
  useEffect(() => {
    const loadSavedProfile = () => {
      try {
        const saved = localStorage.getItem(DISCOURSE_CONFIG.storageKeys.profile)
        if (saved) {
          setProfile(JSON.parse(saved))
        }
      } catch (e) {
        console.error("Failed to load Discourse profile:", e)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedProfile()
  }, [])

  // Handle callback from Discourse (check URL for payload parameter)
  useEffect(() => {
    const handleCallback = async () => {
      if (typeof window === "undefined") return

      const urlParams = new URLSearchParams(window.location.search)
      const payload = urlParams.get("payload")

      if (!payload) return

      setIsLoading(true)
      setError(null)

      try {
        // Get stored auth state
        const authStateJson = localStorage.getItem(DISCOURSE_CONFIG.storageKeys.authState)
        if (!authStateJson) {
          throw new Error("Auth state not found. Please try again.")
        }

        const authState: DiscourseAuthState = JSON.parse(authStateJson)

        // Decrypt the payload
        const decrypted = decryptPayload(payload, authState.privateKeyPem)

        // Validate nonce
        if (decrypted.nonce !== authState.nonce) {
          throw new Error("Security validation failed. Please try again.")
        }

        // Fetch user profile via our proxy route
        const discourseUrl = DISCOURSE_CONFIG.url
        const profileResponse = await fetch("/api/discourse/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discourseUrl, apiKey: decrypted.key }),
        })

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json()
          throw new Error(errorData.error || "Failed to fetch profile")
        }

        const fetchedProfile: DiscourseProfile = await profileResponse.json()

        // Save profile to localStorage
        localStorage.setItem(DISCOURSE_CONFIG.storageKeys.profile, JSON.stringify(fetchedProfile))
        setProfile(fetchedProfile)

        // Clean up auth state
        localStorage.removeItem(DISCOURSE_CONFIG.storageKeys.authState)

        // Clean URL (remove payload parameter)
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete("payload")
        window.history.replaceState({}, "", cleanUrl.toString())
      } catch (e) {
        console.error("Discourse callback error:", e)
        setError(e instanceof Error ? e.message : "Authentication failed")
        // Clean up on error
        localStorage.removeItem(DISCOURSE_CONFIG.storageKeys.authState)
      } finally {
        setIsLoading(false)
      }
    }

    handleCallback()
  }, [])

  const connect = useCallback(async () => {
    if (!DISCOURSE_CONFIG.url) {
      setError("Discourse URL is not configured")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Generate keypair and auth parameters
      const { privateKeyPem, publicKeyPem } = generateKeyPair()
      const nonce = generateNonce()
      const clientId = generateClientId()

      // Save auth state for callback handling
      const authState: DiscourseAuthState = {
        privateKeyPem,
        nonce,
        clientId,
      }
      localStorage.setItem(DISCOURSE_CONFIG.storageKeys.authState, JSON.stringify(authState))

      // Build authorization URL
      const authUrl = buildAuthUrl(DISCOURSE_CONFIG.url, {
        applicationName: DISCOURSE_CONFIG.appName,
        clientId,
        scopes: DISCOURSE_CONFIG.scopes,
        publicKeyPem,
        nonce,
        authRedirect: window.location.href.split("?")[0], // Current page without query params
      })

      // Redirect to Discourse
      window.location.href = authUrl
    } catch (e) {
      console.error("Discourse connect error:", e)
      setError(e instanceof Error ? e.message : "Failed to start authentication")
      setIsLoading(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(DISCOURSE_CONFIG.storageKeys.profile)
    localStorage.removeItem(DISCOURSE_CONFIG.storageKeys.authState)
    setProfile(null)
    setError(null)
  }, [])

  return (
    <DiscourseContext.Provider
      value={{
        isConnected: !!profile,
        isLoading,
        profile,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </DiscourseContext.Provider>
  )
}

export function useDiscourse() {
  const context = useContext(DiscourseContext)
  if (!context) {
    throw new Error("useDiscourse must be used within DiscourseProvider")
  }
  return context
}
