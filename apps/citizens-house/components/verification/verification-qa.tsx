"use client"

import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem } from "@near-citizens/ui"
import { ChevronIcon } from "./icons/chevron-icon"

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
    <section className="flex items-start justify-center bg-white px-4 py-[40px] md:py-[80px] dark:bg-black">
      <div className="flex w-full max-w-[1055px] flex-col gap-[61px]">
        <h3 className="text-[32px] leading-[36px] md:text-[44px] md:leading-[48px] font-fk-grotesk font-medium text-black dark:text-white">
          Q&amp;A
        </h3>
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
              className="border-b border-[#171717] pb-[44px] pt-0 dark:border-[#e3e3ea]"
            >
              <button
                className="flex w-full items-start justify-between py-0 text-left transition-all gap-4 cursor-pointer"
                onClick={() => setOpenItem(openItem === faq.value ? undefined : faq.value)}
              >
                <span
                  className="text-[24px] leading-[32px] md:text-[36px] md:leading-[44px] lg:text-[45px] lg:leading-[52px] text-[#171717] dark:text-[#e3e3ea] font-normal"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  {faq.question}
                </span>
                <div className="flex h-[13px] w-[13px] shrink-0 items-center justify-center mt-2">
                  <ChevronIcon
                    className={`transition-transform duration-200 ${openItem === faq.value ? "rotate-0" : "rotate-90"}`}
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
