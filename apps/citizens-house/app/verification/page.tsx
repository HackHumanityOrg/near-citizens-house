import { VerificationHero } from "@/components/verification/verification-hero"
import { VerificationNeeds } from "@/components/verification/verification-needs"
import { VerificationSteps } from "@/components/verification/verification-steps"
import { VerificationQA } from "@/components/verification/verification-qa"

export default function VerificationPage() {
  return (
    <>
      <VerificationHero />

      <div className="bg-[#f2f2f2] py-[80px] dark:bg-neutral-900">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[64px] px-[16px] lg:px-[80px]">
          <VerificationNeeds />
          <VerificationSteps />
        </div>
      </div>

      <VerificationQA />
    </>
  )
}
