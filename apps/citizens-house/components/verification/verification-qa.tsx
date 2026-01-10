"use client"

import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem } from "@near-citizens/ui"
import { ChevronIcon } from "./icons/chevron-icon"

const faqs = [
  {
    value: "faq-1",
    question: "Why create a NEAR Verified Account?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    value: "faq-2",
    question: "What do I need to be eligible?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  },
  {
    value: "faq-3",
    question: "What sort of ID document can I use?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  },
  {
    value: "faq-4",
    question: "Is my personal information kept private?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  },
  {
    value: "faq-5",
    question: "What happens if I don't complete verification?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
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
