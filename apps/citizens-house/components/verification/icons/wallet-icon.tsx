// Font Awesome Regular Wallet icon
export function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 512 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V192c0-35.3-28.7-64-64-64H80c-8.8 0-16-7.2-16-16s7.2-16 16-16H464c8.8 0 16-7.2 16-16s-7.2-16-16-16H64zM48 96c0-8.8 7.2-16 16-16H448c8.8 0 16 7.2 16 16V416c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V96zm336 96a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" />
    </svg>
  )
}
