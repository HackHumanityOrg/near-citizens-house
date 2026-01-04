interface WalletDisplayFieldProps {
  walletAddress: string
  onDisconnect: () => void
}

export function WalletDisplayField({ walletAddress, onDisconnect }: WalletDisplayFieldProps) {
  return (
    <div className="flex flex-col gap-[8px] w-full">
      {/* Label */}
      <label className="text-[14px] leading-[1.4] font-inter font-semibold text-[#36394a] dark:text-neutral-200 tracking-[0.28px]">
        Connected Wallet
      </label>

      {/* Display field with disconnect link */}
      <div className="bg-white dark:bg-black border border-[#bababa] dark:border-white/20 flex items-center justify-between h-[48px] px-[16px] w-full">
        <span className="text-[14px] leading-[1.4] font-inter text-[#040404] dark:text-neutral-100">
          {walletAddress}
        </span>
        <button
          type="button"
          onClick={onDisconnect}
          className="text-[16px] text-[#171717] dark:text-neutral-300 underline hover:opacity-70 transition-opacity"
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}
