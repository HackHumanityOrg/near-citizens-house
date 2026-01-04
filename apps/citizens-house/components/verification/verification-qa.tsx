"use client"

import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem } from "@near-citizens/ui"
import { ChevronIcon } from "./chevron-icon"

const faqs = [
  {
    value: "faq-1",
    question: "Why Become a NEAR Verified Account?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    value: "faq-2",
    question: "How is my data used?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  },
  {
    value: "faq-3",
    question: "What are the eligibility criteria?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  },
]

export function VerificationQA() {
  const [openItem, setOpenItem] = useState<string | undefined>(undefined)

  return (
    <section className="flex items-start justify-center bg-white px-0 py-[80px] dark:bg-neutral-800">
      <div className="flex w-full max-w-[1055px] flex-col gap-[61px] px-6">
        <h3 className="text-[44px] leading-[48px] font-fk-grotesk font-medium">Q&amp;A</h3>
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
              className="border-b border-[#171717] pb-[44px] pt-0 dark:border-neutral-700"
            >
              <button
                className="flex w-full items-start justify-between py-0 text-left transition-all"
                onClick={() => setOpenItem(openItem === faq.value ? undefined : faq.value)}
              >
                <span className="text-[32px] leading-[40px] text-[#171717] dark:text-neutral-100 md:text-[45px] md:leading-[52px] font-fk-grotesk">
                  {faq.question}
                </span>
                <div className="flex h-[13px] w-[13px] shrink-0 items-center justify-center">
                  <ChevronIcon
                    className={`transition-transform duration-200 ${openItem === faq.value ? "rotate-0" : "rotate-90"}`}
                  />
                </div>
              </button>
              <AccordionContent className="pt-[24px] text-[16px] leading-[24px] text-[#171717]/90 dark:text-neutral-200">
                <div className="font-fk-grotesk">{faq.answer}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
