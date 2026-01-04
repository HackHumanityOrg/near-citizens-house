import { Clock, Stamp, Wallet } from "lucide-react"

const needs = [
  {
    title: "NEAR Wallet",
    Icon: Wallet,
  },
  {
    title: "Passport",
    Icon: Stamp,
  },
  {
    title: "8-12 minutes",
    Icon: Clock,
  },
]

export function VerificationNeeds() {
  return (
    <div className="flex w-full flex-col items-center gap-[64px]">
      <h3 className="text-center text-[44px] leading-[48px] font-fk-grotesk font-medium">What you&apos;ll need</h3>

      <div className="grid w-full grid-cols-1 gap-[40px] md:grid-cols-3">
        {needs.map(({ title, Icon }) => (
          <div key={title} className="flex flex-col gap-[24px] bg-white p-[24px] dark:bg-neutral-800">
            <Icon className="h-10 w-10 text-black dark:text-neutral-100" aria-hidden="true" />
            <p className="text-[22px] text-[#171717] dark:text-neutral-100 font-fk-grotesk">{title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
