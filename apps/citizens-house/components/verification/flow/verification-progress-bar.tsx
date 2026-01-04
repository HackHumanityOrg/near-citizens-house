interface VerificationProgressBarProps {
  currentStep: 1 | 2 | 3
}

export function VerificationProgressBar({ currentStep }: VerificationProgressBarProps) {
  // Calculate progress percentage based on step
  // Step 1: ~33%, Step 2: ~66%, Step 3: 100%
  const getProgressWidth = () => {
    switch (currentStep) {
      case 1:
        return "33.33%"
      case 2:
        return "67.33%"
      case 3:
        return "100%"
      default:
        return "0%"
    }
  }

  return (
    <div className="sticky top-[32px] left-0 right-0 z-40 bg-[#f2f2f2] dark:bg-neutral-900">
      <div
        className="h-[4px] bg-[#00ec97] transition-all duration-500 ease-in-out shadow-[0_0_8px_rgba(0,236,151,0.6)]"
        style={{ width: getProgressWidth() }}
      />
    </div>
  )
}
