import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "./utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Citizens page variants
        "citizens-primary":
          "bg-[#040404] text-[#d8d8d8] hover:bg-[#1c1c1c] rounded-[4px] dark:bg-[#fcfaf7] dark:text-[#1c1c1c] dark:hover:bg-[#e0e0e0]",
        "citizens-outline":
          "border border-[#bdbdbd] bg-white text-[#040404] hover:bg-[#fafafc] rounded-[4px] dark:border-[#404040] dark:bg-transparent dark:text-[#fcfaf7] dark:hover:bg-[#2a2a2a]",
        "citizens-icon":
          "border border-[#bdbdbd] bg-white hover:bg-[#fafafc] rounded-[4px] dark:border-[#404040] dark:bg-transparent dark:hover:bg-[#2a2a2a]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // Citizens page sizes
        "citizens-sm": "h-[28px] px-3 text-[12px]",
        "citizens-md": "h-[32px] px-[14px] text-[14px]",
        "citizens-lg": "h-[36px] px-4 text-[14px]",
        "citizens-xl": "h-[40px] px-4 text-[14px]",
        "citizens-2xl": "h-[44px] px-5 text-[14px]",
        "citizens-icon": "h-[36px] w-[36px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
