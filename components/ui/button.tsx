import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.2),0_1px_3px_0_rgba(0,0,0,0.05)] hover:shadow-none active:translate-y-px active:scale-[0.995]",
        secondary:
          "bg-secondary text-secondary-foreground border border-input shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.1)] hover:shadow-none hover:bg-secondary/80 active:translate-y-px active:scale-[0.99]",
        tertiary:
          "bg-transparent text-foreground border-2 border-input hover:bg-muted hover:border-primary active:scale-[0.99]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.2)] hover:shadow-none hover:bg-destructive/90 active:translate-y-px active:scale-[0.995]",
        outline: "border border-input bg-background hover:bg-muted hover:text-foreground active:scale-[0.99]",
        ghost: "hover:bg-muted/50 hover:text-foreground active:scale-[0.99]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
