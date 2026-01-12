"use client"

import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem } from "@near-citizens/ui"
import { ChevronIcon } from "./icons/chevron-icon"

const faqs = [
  {
    value: "faq-1",
    question: "Why create a NEAR Verified Account?",
    answer: (
      <>
        <p className="mb-4">
          A NEAR Verified Account is a NEAR account that has successfully completed an automated verification process,
          confirming that the account is controlled by a unique, identifiable person.
        </p>
        <p className="mb-4">
          Creating a NEAR Verified Account enables you to participate in votes on NEAR governance decisions that must be
          made on a "one person = one vote" basis.
        </p>
        <p className="mb-4">
          Verification creates a{" "}
          <a
            href="https://en.wikipedia.org/wiki/Zero-knowledge_proof"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            zero-knowledge proof
          </a>{" "}
          linking your NEAR account to a unique human identity. The proof is generated through the{" "}
          <a href="https://self.xyz" target="_blank" rel="noopener noreferrer" className="underline">
            Self app
          </a>
          , which verifies that you hold a unique biometric identity document and shares proof of that with Citizens
          House, without revealing your identity to anyone.
        </p>
        <p className="mb-4">
          Each real-world identity can only be linked to a single NEAR account, and each NEAR account can only be linked
          to a single real-world identity. This ensures fair, one-person-one-vote governance.
        </p>
        <p className="mb-4">
          This verification system establishes trusted governance participants, ensures voting integrity, and preventing
          Sybil attacks.
        </p>
        <p className="mb-4">
          The first governance action using Citizens House will be a vote on the proposed transfer of assets from the
          NEAR Community Purpose Trust to the House of Stake Foundation.
        </p>
        <p>
          Designed for ongoing NEAR governance, once you create a NEAR Verified Account, the verification is stored
          on-chain and remains valid for participating in governance decisions.
        </p>
      </>
    ),
  },
  {
    value: "faq-2",
    question: "What do I need to be eligible?",
    answer: (
      <>
        <p className="mb-4">The only requirements to create a NEAR Verified Account are that you must:</p>
        <ol className="list-decimal pl-6 mb-4 space-y-2">
          <li>
            <strong>Control a NEAR account</strong> - You need to have an existing NEAR wallet that you can connect and
            sign messages with
          </li>
          <li>
            <strong>Have a biometric ID</strong> - You must possess a biometric ID document that can be verified using
            the Self app
          </li>
        </ol>
        <p className="mb-4">
          There are no additional restrictions based on NEAR account age or history, date of birth, nationality, country
          of residence, any sanctions lists, or anything else.
        </p>
        <p className="mb-4">Each person can create one NEAR Verified Account linked to one unique identity document.</p>
        <p>
          <strong>Anyone who attempts to create multiple NEAR Verified Accounts will be excluded from voting.</strong>
        </p>
      </>
    ),
  },
  {
    value: "faq-3",
    question: "What sort of ID document can I use?",
    answer: (
      <>
        <p className="mb-4">You can use any biometric ID document that can be verified using the Self app:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            A{" "}
            <a
              href="https://en.wikipedia.org/wiki/Biometric_passport"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              biometric passport
            </a>{" "}
            issued by any of 125 countries (
            <a
              href="https://docs.self.xyz/use-self/self-map-countries-list"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              list
            </a>{" "}
            |{" "}
            <a href="https://map.self.xyz/" target="_blank" rel="noopener noreferrer" className="underline">
              map
            </a>
            )
          </li>
          <li>
            An{" "}
            <a
              href="https://self.xyz/blog/self-now-supports-eu-id-scanning-for-identity-verification"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              EU-standard biometric national ID card
            </a>{" "}
            issued from any of the 27 EU countries
          </li>
          <li>
            An{" "}
            <a
              href="https://docs.self.xyz/document-specification/aadhaar"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Aadhaar national ID card
            </a>{" "}
            in India
          </li>
        </ul>
        <p>
          The{" "}
          <a href="https://self.xyz" target="_blank" rel="noopener noreferrer" className="underline">
            Self app
          </a>{" "}
          is compatible with iOS 15.1+ and Android 7.0+ and relies on your device's camera and NFC reader to verify your
          ID document.
        </p>
      </>
    ),
  },
  {
    value: "faq-4",
    question: "Is my personal information kept private?",
    answer: (
      <>
        <p className="mb-4">
          Yes. The verification system uses zero-knowledge proofs, meaning your identity is verified without revealing
          personal information publicly. No personally identifiable information (PII) is collected or retained beyond
          what's necessary for verification.
        </p>
        <p className="mb-4">Your data are handled with strict privacy protections.</p>
        <p className="mb-4">Self's architecture prevents disclosure of personal details.</p>
        <p className="mb-6">
          The only information disclosed from your document to Citizens House is your nationality, which we record for
          analytics and fraud-prevention purposes. This does not get published on-chain.
        </p>

        <p className="font-medium mb-2">What we verify:</p>
        <ol className="list-decimal pl-6 mb-4 space-y-1">
          <li>That you control a NEAR account</li>
          <li>That your identity meets the eligibility criteria</li>
          <li>That you are a unique person (preventing duplicate verifications)</li>
        </ol>

        <p className="font-medium mb-2">What we store:</p>
        <ol className="list-decimal pl-6 mb-4 space-y-1">
          <li>Your NEAR account ID</li>
          <li>Your verification proof (stored on-chain as a zero-knowledge proof)</li>
        </ol>

        <p className="font-medium mb-2">What we share:</p>
        <ol className="list-decimal pl-6 mb-4 space-y-1">
          <li>An on-chain transaction linking your NEAR account ID to your verification proof</li>
          <li>
            Non-identifiable data shared with service providers for the purposes of providing the service and gathering
            analytics and feedback to improve the service
          </li>
        </ol>

        <p>
          For more details, see our{" "}
          <a
            href="https://www.citizenshouse.org/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy Policy
          </a>{" "}
          and the{" "}
          <a href="https://self.xyz/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            Self Privacy Notice
          </a>
          .
        </p>
      </>
    ),
  },
  {
    value: "faq-5",
    question: "What happens if I don't complete verification?",
    answer: (
      <>
        <p className="mb-4">
          If you don't complete the verification process within your session (10 minutes), you'll need to start again.
          You can reuse the same NEAR account and Self credential on subsequent attempts until a successful verification
          is completed.
        </p>
        <p>
          If you encounter issues during the verification process or have any questions, please{" "}
            <a href="https://t.me/nearcitizenshouse/6" target="_blank" rel="noopener noreferrer" className="underline">
              reach out for Support
            </a>
          . We will get back to you promptly to help you create your NEAR Verified Account.
        </p>
      </>
    ),
  },
]

export function VerificationQA() {
  const [openItem, setOpenItem] = useState<string | undefined>(undefined)

  return (
    <section className="flex items-start justify-center bg-white dark:bg-[#181921] px-6 md:px-[80px] py-[40px] md:py-[80px]">
      <div className="flex w-full max-w-[1055px] flex-col gap-[61px]">
        {/* Q&A Heading - Figma: 62px/72px, FK Grotesk Medium, text-black */}
        <h2 className="text-[44px] leading-[48px] md:text-[62px] md:leading-[72px] font-fk-grotesk font-medium text-black dark:text-white">
          Q&amp;A
        </h2>
        <Accordion
          type="single"
          collapsible
          className="flex w-full flex-col gap-[44px] opacity-[0.88]"
          value={openItem}
          onValueChange={setOpenItem}
        >
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.value}
              value={faq.value}
              className="border-b border-[#171717] dark:border-[#e3e3ea] pb-[44px] pt-0"
            >
              <button
                className="flex w-full items-start justify-between py-0 text-left transition-all gap-4 cursor-pointer"
                onClick={() => setOpenItem(openItem === faq.value ? undefined : faq.value)}
              >
                {/* Question text - Figma: FK Grotesk Medium, 30px/36px, text-[#171717] */}
                <span className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] text-[#171717] dark:text-[#e3e3ea] font-fk-grotesk font-medium">
                  {faq.question}
                </span>
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center mt-1 text-[#171717] dark:text-[#e3e3ea]">
                  <ChevronIcon
                    className={`transition-transform duration-200 ${openItem === faq.value ? "rotate-180" : "rotate-0"}`}
                  />
                </div>
              </button>
              <AccordionContent className="pt-[16px] md:pt-[24px] text-[14px] leading-[20px] md:text-[16px] md:leading-[24px] text-[#171717]/90 dark:text-[#e3e3ea]">
                <div className="font-fk-grotesk">{faq.answer}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
