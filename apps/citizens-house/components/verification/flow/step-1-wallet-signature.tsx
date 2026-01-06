"use client"

interface Step1WalletSignatureProps {
  accountId: string | null
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
  return (
    <div className="w-full">
      <div className="flex flex-col gap-[24px] items-center text-center w-full py-[40px] px-4">
        <p className="text-[18px] sm:text-[22px] leading-[28px] text-[#878787] dark:text-[#a3a3a3] font-medium">
          Step 1 of 2
        </p>
        <h1 className="text-[32px] sm:text-[44px] leading-[40px] sm:leading-[48px] text-[#111] dark:text-white font-fk-grotesk font-medium">
          Verify your wallet
        </h1>
      </div>
      <div className="flex flex-col items-center pb-0 pt-0 w-full px-4">
        <div className="flex flex-col items-start w-full max-w-[650px]">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex items-center justify-center py-[40px] px-4 sm:px-0 w-full">
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full max-w-[520px]">
                {/* Card Title */}
                <div className="flex h-[30.945px] items-center justify-center w-full">
                  <div className="w-full">
                    <div className="flex flex-col font-inter font-semibold justify-center leading-[0] text-[24px] text-[#090909] dark:text-white tracking-[0.48px] w-full">
                      <p className="leading-[1.2]">Sign Verification Message</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col font-inter font-normal justify-center leading-[0] text-[14px] text-[#090909] dark:text-neutral-200 w-full">
                  <p className="leading-[1.4]">
                    Sign a message to prove your own this NEAR wallet. This signature will be cryptographically linked
                    to your identity proof.
                  </p>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-[16px] items-start py-[8px] px-0 w-full">
                  {isConnected && accountId ? (
                    <>
                      {/* Text field group */}
                      <div className="flex flex-col gap-[12px] items-start w-full">
                        {/* Wallet Display */}
                        <div className="flex flex-col gap-[8px] w-full">
                          <label className="text-[14px] leading-[1.4] font-inter font-semibold text-[#36394a] dark:text-neutral-200 tracking-[0.28px]">
                            Connected Wallet
                          </label>
                          <div className="bg-white dark:bg-black border border-[#bababa] dark:border-white/20 flex items-center justify-between h-[48px] px-[16px] w-full">
                            <span className="text-[14px] leading-[1.4] font-inter text-[#040404] dark:text-neutral-100">
                              {accountId}
                            </span>
                            <button
                              type="button"
                              onClick={onDisconnect}
                              className="text-[16px] text-[#171717] dark:text-neutral-300 underline cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>

                        {/* Help Text */}
                        <p className="font-inter font-medium leading-[1.4] text-[12px] text-[rgba(27,31,38,0.72)] dark:text-[#a3a3a3] w-full">
                          This will open your wallet to sign a message. No transaction fee required.
                        </p>
                      </div>

                      {/* Button section */}
                      <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                        <button
                          onClick={onSign}
                          disabled={isSigning}
                          className="flex-1 bg-[#040404] dark:bg-white flex gap-[8px] h-[56px] items-center justify-center px-[24px] py-[14px] rounded-[4px] min-h-px min-w-px cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <p className="font-inter font-medium leading-[20px] text-[16px] text-[#d8d8d8] dark:text-[#040404] text-center text-nowrap">
                            {isSigning ? "Signing..." : "Sign Message"}
                          </p>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Connect Wallet Button */
                    <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                      <button
                        onClick={onConnect}
                        disabled={isLoading}
                        className="flex-1 bg-[#040404] dark:bg-white flex gap-[8px] h-[56px] items-center justify-center px-[24px] py-[14px] rounded-[4px] min-h-px min-w-px cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <p className="font-inter font-medium leading-[20px] text-[16px] text-[#d8d8d8] dark:text-[#040404] text-center text-nowrap">
                          {isLoading ? "Connecting..." : "Connect NEAR Wallet"}
                        </p>
                      </button>
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
