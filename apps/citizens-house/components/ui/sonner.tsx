"use client"

import { Toaster as Sonner } from "sonner"
import { Check } from "lucide-react"

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={80}
      duration={3000}
      icons={{
        success: <Check className="w-5 h-5 text-white dark:text-black" strokeWidth={2.5} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 bg-verified text-white dark:text-black rounded-[8px] pl-4 pr-4 py-2 shadow-lg",
          title: "font-fk-grotesk text-[14px] leading-[1.4] text-white dark:text-black",
        },
      }}
    />
  )
}
