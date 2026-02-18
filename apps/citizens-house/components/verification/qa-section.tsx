"use client"

import { useState, type ReactNode } from "react"
import { Accordion, AccordionContent, AccordionItem } from "@near-citizens/ui"
import { ChevronIcon } from "./icons/chevron-icon"

export type QASectionItem = {
  value: string
  question: string
  answer: ReactNode
}

type QASectionProps = {
  faqs: QASectionItem[]
  title?: string
  sectionClassName?: string
}

const defaultSectionClassName =
  "flex items-start justify-center bg-white dark:bg-[#181921] px-6 md:px-[80px] py-[40px] md:py-[80px]"

export function QASection({ faqs, title = "Q&A", sectionClassName = defaultSectionClassName }: QASectionProps) {
  const [openItem, setOpenItem] = useState<string | undefined>(undefined)

  return (
    <section className={sectionClassName}>
      <div className="flex w-full max-w-[1055px] flex-col gap-[61px]">
        <h2 className="text-[44px] leading-[48px] md:text-[62px] md:leading-[72px] font-fk-grotesk font-medium text-black dark:text-white">
          {title}
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
