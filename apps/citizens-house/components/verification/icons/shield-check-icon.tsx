export function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_shield)">
        <path
          d="M12 2L4 5V11C4 16.55 7.84 21.74 12 23C16.16 21.74 20 16.55 20 11V5L12 2Z"
          stroke="#5e4f02"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M9 12L11 14L15 10"
          stroke="#5e4f02"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
      <defs>
        <clipPath id="clip0_shield">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}
