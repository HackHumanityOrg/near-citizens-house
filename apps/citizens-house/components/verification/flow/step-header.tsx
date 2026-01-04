interface StepHeaderProps {
  currentStep: number
  totalSteps: number
  title: string
  subtitle?: string
}

export function StepHeader({ currentStep, totalSteps, title, subtitle }: StepHeaderProps) {
  return (
    <div className="flex flex-col gap-[24px] items-center text-center w-full py-[40px] px-4">
      {/* Step indicator */}
      <p className="text-[18px] sm:text-[22px] leading-[28px] text-[#878787] dark:text-[#a3a3a3] font-medium">
        Step {currentStep} of {totalSteps}
      </p>

      {/* Title */}
      <h1 className="text-[32px] sm:text-[44px] leading-[40px] sm:leading-[48px] text-[#111] dark:text-white font-fk-grotesk font-medium">
        {title}
      </h1>

      {/* Optional subtitle */}
      {subtitle && (
        <p className="text-[20px] sm:text-[28px] leading-[28px] sm:leading-[36px] text-black dark:text-neutral-200 font-normal">
          {subtitle}
        </p>
      )}
    </div>
  )
}
