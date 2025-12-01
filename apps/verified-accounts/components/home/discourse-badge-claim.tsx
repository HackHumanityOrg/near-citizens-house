"use client"

import { useEffect } from "react"
import { useDiscourse } from "@near-citizens/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@near-citizens/ui"
import { Loader2, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react"

interface DiscourseVerificationProps {
  onSuccess: () => void
  onError: (error: string) => void
  onDisconnectWallet?: () => void
}

export function DiscourseBadgeClaim({ onSuccess, onError, onDisconnectWallet }: DiscourseVerificationProps) {
  const { isConnected, isLoading, profile, connect, disconnect, error } = useDiscourse()

  // Notify parent when connection succeeds
  useEffect(() => {
    if (isConnected && profile) {
      onSuccess()
    }
  }, [isConnected, profile, onSuccess])

  // Notify parent of errors
  useEffect(() => {
    if (error) {
      onError(error)
    }
  }, [error, onError])

  const handleConnect = async () => {
    await connect()
  }

  // Show connected profile
  if (isConnected && profile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle>Discourse Connected</CardTitle>
          </div>
          <CardDescription>Your Discourse forum account is linked</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-background rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
              <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{profile.name || profile.username}</span>
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
              </div>
              <div className="text-sm text-muted-foreground truncate">@{profile.username}</div>
              {profile.email && <div className="text-xs text-muted-foreground truncate">{profile.email}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Trust Level</div>
              <div className="text-sm font-medium">{profile.trust_level}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect} className="w-full">
            Sign out of Discourse
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle>Connecting to Discourse</CardTitle>
          </div>
          <CardDescription>Please wait while we verify your account...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
        </CardContent>
      </Card>
    )
  }

  // Show connect button
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle>Link Discourse Account</CardTitle>
        </div>
        <CardDescription>Connect your Discourse forum account to complete the verification process</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleConnect} size="lg" className="w-full" disabled={isLoading} aria-busy={isLoading}>
          <MessageSquare className="h-5 w-5 mr-2" aria-hidden="true" />
          Sign in with Discourse
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You will be redirected to Discourse to authorize this application
        </p>

        {onDisconnectWallet && (
          <Button variant="ghost" size="sm" onClick={onDisconnectWallet} className="w-full">
            Disconnect Wallet
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
