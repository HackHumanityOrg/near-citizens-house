"use client"

import { Button } from "@near-citizens/ui"
import { StarPattern } from "../icons/star-pattern"
import type { NearAccountId } from "@near-citizens/shared"

interface Step1WalletSignatureProps {
  accountId: NearAccountId | null
  isConnected: boolean
  isLoading: boolean
  isSigning: boolean
  onConnect: () => void
  onDisconnect: () => void
  onSign: () => void
}

export function Step1WalletSignature({
  accountId,
  isConnected,
  isLoading,
  isSigning,
  onConnect,
  onDisconnect,
  onSign,
}: Step1WalletSignatureProps) {
  const hasWallet = isConnected && accountId

  const title = hasWallet ? "Sign Verification Message" : "Connect NEAR Wallet"

  const description = hasWallet
    ? "Sign a message to prove you own this NEAR wallet. This signature will be cryptographically linked to your identity proof."
    : "First, connect your NEAR wallet to begin the identity verification process."

  return (
    <div className="w-full">
      {/* Hero Section with gradient background - extends behind header */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="step1Star" />
        </div>

        {/* Step indicator - positioned in upper area of hero */}
        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          {/* Stepper - consistent width across all steps */}
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            {/* Fixed-width columns for circles (40px each), flexible middle for line */}
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              {/* Step 1 circle */}
              <div className="col-start-1 row-start-1 flex items-center justify-center">
                <div
                  data-testid="step-indicator-1"
                  data-step-state="active"
                  className="border-2 border-black dark:border-white bg-white dark:bg-black flex items-center justify-center rounded-full size-[40px]"
                >
                  <span className="font-fk-grotesk font-medium md:font-bold text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    1
                  </span>
                </div>
              </div>

              {/* Connecting line - equidistant from both circles, vertically centered */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black dark:bg-white/40" />
              </div>

              {/* Step 2 circle */}
              <div className="col-start-3 row-start-1 flex items-center justify-center">
                <div
                  data-testid="step-indicator-2"
                  data-step-state="inactive"
                  className="border-2 border-[rgba(128,128,128,0.55)] dark:border-white/30 flex items-center justify-center rounded-full size-[40px]"
                >
                  <span className="font-fk-grotesk font-medium text-[20px] leading-[28px] text-[rgba(128,128,128,0.55)] dark:text-white/30">
                    2
                  </span>
                </div>
              </div>

              {/* Labels row - overflow their 40px columns, centered under circles */}
              <span
                data-testid="step-label-1"
                className="col-start-1 row-start-2 justify-self-center font-fk-grotesk md:font-bold text-[16px] md:text-[20px] leading-[28px] text-[#090909] dark:text-white whitespace-nowrap text-center"
              >
                Verify NEAR Wallet
              </span>
              <span
                data-testid="step-label-2"
                className="col-start-3 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-[rgba(128,128,128,0.55)] dark:text-white/30 whitespace-nowrap text-center"
              >
                Verify Identity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section - overlaps with hero via negative margin */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4">
        <div className="flex flex-col items-start w-full max-w-[650px]">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center py-[40px] px-4 md:px-0 w-full">
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full max-w-[520px]">
                {/* Card Title */}
                <div className="flex items-center justify-center w-full">
                  <p
                    data-testid="step1-card-title"
                    className="font-fk-grotesk font-medium text-[24px] leading-[32px] text-[#090909] dark:text-white w-full"
                  >
                    {title}
                  </p>
                </div>

                {/* Description */}
                <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#090909] dark:text-neutral-200 w-full">
                  {description}
                </p>

                {/* Content */}
                <div className="flex flex-col gap-[16px] items-start py-[8px] px-0 w-full">
                  {hasWallet ? (
                    <>
                      {/* Text field group */}
                      <div className="flex flex-col gap-[12px] items-start w-full">
                        {/* Wallet Display */}
                        <div className="flex flex-col gap-[8px] w-full">
                          <label className="font-fk-grotesk text-[14px] leading-[14px] text-[#36394a] dark:text-neutral-200">
                            Connected Wallet
                          </label>
                          <div
                            data-testid="connected-wallet-display"
                            className="bg-white dark:bg-black border border-[#bababa] dark:border-white/20 rounded-[4px] flex items-center justify-between h-[48px] px-[16px] w-full"
                          >
                            <span
                              data-testid="connected-wallet-address"
                              className="font-fk-grotesk text-[16px] leading-[28px] text-[#040404] dark:text-neutral-100"
                            >
                              {accountId}
                            </span>
                            <button
                              type="button"
                              onClick={onDisconnect}
                              data-testid="disconnect-wallet-button"
                              className="font-fk-grotesk text-[16px] leading-[1.4] text-[#171717] dark:text-neutral-300 underline cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>

                        {/* Help Text */}
                        <p className="font-fk-grotesk text-[12px] leading-[20px] text-[rgba(27,31,38,0.72)] dark:text-[#a3a3a3] w-full">
                          This will open your wallet to sign a message. No transaction fee required.
                        </p>
                      </div>

                      {/* Button section */}
                      <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                        <Button
                          onClick={onSign}
                          disabled={isSigning}
                          variant="citizens-primary"
                          size="citizens-3xl"
                          data-testid="sign-message-button"
                          className="flex-1"
                        >
                          {isSigning ? "Signing..." : "Sign Message"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* Connect Wallet Button */
                    <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                      <Button
                        onClick={onConnect}
                        disabled={isLoading}
                        variant="citizens-primary"
                        size="citizens-3xl"
                        data-testid="connect-near-wallet-button"
                        className="flex-1"
                      >
                        {isLoading ? "Connecting..." : "Connect Wallet"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
