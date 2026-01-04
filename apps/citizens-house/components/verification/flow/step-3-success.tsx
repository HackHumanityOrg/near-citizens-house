"use client"

interface Step3SuccessProps {
  accountId: string
  onDisconnect?: () => void
  onVoteForProposals?: () => void
}

export function Step3Success({ accountId, onDisconnect, onVoteForProposals }: Step3SuccessProps) {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Title section */}
      <div className="flex flex-col items-center gap-2 pt-20 pb-6">
        <h1 className="text-[44px] leading-[48px] text-black dark:text-white font-fk-grotesk font-medium text-center">
          Verification Complete
        </h1>
        <p className="text-[28px] leading-[36px] text-black dark:text-neutral-200 font-normal text-center">
          Now you can start voting
        </p>
      </div>

      {/* Vote button */}
      {onVoteForProposals && (
        <button
          onClick={onVoteForProposals}
          className="bg-[#040404] dark:bg-white text-[#d8d8d8] dark:text-[#040404] px-6 py-3.5 rounded font-inter font-medium text-base leading-5 mb-10 hover:opacity-90 transition-opacity"
        >
          Vote for Proposals
        </button>
      )}

      {/* Success details card */}
      <div className="w-[650px] bg-white dark:bg-neutral-800 border border-[rgba(0,0,0,0.1)] dark:border-neutral-700 py-10">
        <div className="w-[600px] mx-auto bg-[#f9f9f9] dark:bg-black/30 p-6 rounded">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-[22px] leading-[28px] text-black dark:text-white font-medium mb-4">
              Verification Complete
            </h2>
            <p className="text-base leading-6 text-black dark:text-neutral-200 font-fk-grotesk">
              Your identity is verified on-chain and you have authenticated with Discourse.
            </p>
          </div>

          {/* Account details */}
          <div className="space-y-0">
            {/* NEAR Account row */}
            <div className="flex items-center justify-between py-6 border-b border-[rgba(0,0,0,0.16)] dark:border-neutral-700">
              <span className="text-base leading-6 text-black dark:text-neutral-200 font-fk-grotesk">NEAR Account</span>
              <span className="text-base leading-6 text-black dark:text-white font-fk-grotesk font-bold">
                {accountId}
              </span>
            </div>

            {/* Identity Status row */}
            <div className="flex items-center justify-between py-6 border-b border-[rgba(0,0,0,0.16)] dark:border-neutral-700">
              <span className="text-base leading-6 text-black dark:text-neutral-200 font-fk-grotesk">
                Identity Status
              </span>
              <div className="bg-[rgba(0,236,151,0.8)] px-4 py-2 rounded-full">
                <span className="text-[12px] leading-[1.4] text-black font-poppins">Verified</span>
              </div>
            </div>
          </div>

          {/* Disconnect button */}
          {onDisconnect && (
            <div className="mt-6 pt-6 flex justify-center">
              <button
                onClick={onDisconnect}
                className="text-base leading-5 text-[#040404] dark:text-neutral-200 font-inter font-medium py-2.5 hover:opacity-70 transition-opacity"
              >
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
