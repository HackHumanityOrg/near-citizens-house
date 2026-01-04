interface VerificationProgressBarProps {
  currentStep: 1 | 2 | 3
}

export function VerificationProgressBar({ currentStep }: VerificationProgressBarProps) {
  // Calculate progress percentage based on step
  // Step 1: 33.33%, Step 2: 66.67%, Step 3: 100%
  const getProgressWidth = () => {
    switch (currentStep) {
      case 1:
        return "33.33%"
      case 2:
        return "66.67%"
      case 3:
        return "100%"
      default:
        return "0%"
    }
  }

  return (
    <div className="sticky top-[32px] left-0 right-0 z-40 bg-white dark:bg-black">
      <div
        className="h-[4px] bg-[#ffda1e] transition-all duration-500 ease-in-out shadow-[0_0_8px_rgba(255,218,30,0.6)]"
        style={{ width: getProgressWidth() }}
      />
    </div>
  )
}
