import { QASection } from "./qa-section"

const waitingFaqs = [
  {
    value: "waiting-faq-1",
    question: "How to vote?",
    answer: (
      <>
        <p className="mb-4">
          To participate in the Vote, you needed to create a <strong>NEAR Verified Account</strong> during the
          Verification Period (February 2&ndash;16, 2026). Only <strong>NEAR Verified Accounts</strong> that
          successfully completed verification before the deadline are eligible to vote.
        </p>
        <p className="mb-4">
          Voting will take place from <strong>February 23, 2026 at 18:00 UTC until March 9, 2026 at 18:00 UTC</strong>.
          During this period, eligible <strong>NEAR Verified Accounts</strong> can cast one vote (YES or NO) on the
          Proposal.
        </p>
        <p className="mb-4">
          To vote, you must connect and use the same NEAR account that was verified (your whitelisted wallet). Voting is
          conducted on a one-person, one-vote basis. Once you have cast your vote, it cannot be changed.
        </p>
        <p>
          The outcome of the Vote will be published on <strong>March 9, 2026 by 23:00 UTC</strong>.
        </p>
      </>
    ),
  },
]

export function WaitingQA() {
  return (
    <QASection
      title="Q&A"
      faqs={waitingFaqs}
      sectionClassName="flex items-start justify-center bg-white dark:bg-black px-6 md:px-[80px] pt-[40px] md:pt-[80px] pb-[80px] md:pb-[120px]"
    />
  )
}
