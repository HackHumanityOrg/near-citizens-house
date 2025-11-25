import * as React from "react"

import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  // Pattern options
  pattern?: "grid" | "diagonal" | "diamond" | "noise"
  patternSize?: "sm" | "md" | "lg"
  patternDensity?: number // Multiplier for density (higher = more dense)
  patternOpacity?: number
  patternFade?:
    | "none"
    | "radial-in"
    | "radial-out"
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"

  // Decorative elements
  corners?: "none" | "dots" | "crosshairs" | "dots-accent" | "crosshairs-accent"
  extendingLines?: "none" | "full" | "gradient"

  // Style options
  noBorder?: boolean
  interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      children,
      pattern,
      patternSize = "md",
      patternDensity = 3,
      patternOpacity,
      patternFade = "none",
      corners = "none",
      extendingLines = "none",
      noBorder = false,
      interactive = false,
      ...props
    },
    ref,
  ) => {
    const getSizeValue = () => {
      const sizes = { sm: 12, md: 20, lg: 32 }
      return sizes[patternSize] / patternDensity
    }

    const size = getSizeValue()
    const patternId = React.useId()

    const getMaskStyle = () => {
      const masks = {
        none: "none",
        "radial-in": "radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
        "radial-out": "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,1) 100%)",
        top: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, transparent 100%)",
        bottom: "linear-gradient(to top, rgba(0,0,0,1) 0%, transparent 100%)",
        left: "linear-gradient(to right, rgba(0,0,0,1) 0%, transparent 100%)",
        right: "linear-gradient(to left, rgba(0,0,0,1) 0%, transparent 100%)",
        "top-left":
          "radial-gradient(ellipse 120% 120% at 0% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.2) 50%, transparent 70%)",
        "top-right":
          "radial-gradient(ellipse 120% 120% at 100% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.2) 50%, transparent 70%)",
        "bottom-left":
          "radial-gradient(ellipse 120% 120% at 0% 100%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.2) 50%, transparent 70%)",
        "bottom-right":
          "radial-gradient(ellipse 120% 120% at 100% 100%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.2) 50%, transparent 70%)",
      }
      return masks[patternFade] || "none"
    }

    const maskStyle = getMaskStyle()

    return (
      <div
        ref={ref}
        className={cn(
          "relative isolate rounded-sm bg-card text-card-foreground transition-all duration-200",
          !noBorder && "border border-border shadow-sm",
          pattern && corners !== "crosshairs" && "overflow-hidden",
          interactive &&
            "cursor-pointer hover:-translate-y-1 hover:shadow-[0_6px_12px_-3px_rgba(0,0,0,0.04),0_3px_6px_-1px_rgba(0,0,0,0.04),6px_6px_0_rgba(0,0,0,0.03),-6px_-6px_0_rgba(0,0,0,0.03)] hover:border-border/80 active:translate-y-0 active:shadow-sm",
          className,
        )}
        {...props}
      >
        {/* Extending lines - positioned to intersect with corner dots */}
        {extendingLines === "full" && (
          <>
            <div className="absolute -top-px -left-[100vw] -z-10 h-px w-[200vw] bg-border/30" />
            <div className="absolute -bottom-px -left-[100vw] -z-10 h-px w-[200vw] bg-border/30" />
            <div className="absolute -left-px -top-[100vh] -z-10 w-px h-[200vh] bg-border/30" />
            <div className="absolute -right-px -top-[100vh] -z-10 w-px h-[200vh] bg-border/30" />
          </>
        )}

        {extendingLines === "gradient" && (
          <>
            {/* Horizontal gradient lines */}
            <div
              className="absolute -top-px -left-[100vw] -z-10 h-px w-[200vw] bg-gradient-to-r from-transparent via-border/40 to-transparent"
              style={{
                maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
              }}
            />
            <div
              className="absolute -bottom-px -left-[100vw] -z-10 h-px w-[200vw] bg-gradient-to-r from-transparent via-border/40 to-transparent"
              style={{
                maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
              }}
            />

            {/* Vertical gradient lines */}
            <div
              className="absolute -left-px -top-[100vh] -z-10 w-px h-[200vh] bg-gradient-to-b from-transparent via-border/40 to-transparent"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
              }}
            />
            <div
              className="absolute -right-px -top-[100vh] -z-10 w-px h-[200vh] bg-gradient-to-b from-transparent via-border/40 to-transparent"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
              }}
            />
          </>
        )}

        {/* Pattern overlay */}
        {pattern &&
          (pattern === "noise" ? (
            <>
              {/* Unified animated grain - TV static effect */}
              {/* Layer 1 - Fast movement */}
              <div
                className="pointer-events-none absolute -inset-[100%] -z-10 h-[300%] w-[300%] opacity-[0.4] dark:opacity-[0.3]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.2' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
                  backgroundSize: "100px 100px",
                  backgroundRepeat: "repeat",
                  opacity: patternOpacity,
                  maskImage: maskStyle !== "none" ? maskStyle : undefined,
                  WebkitMaskImage: maskStyle !== "none" ? maskStyle : undefined,
                  animation: "grain 0.2s steps(10) infinite",
                }}
              />
              {/* Layer 2 - Interference pattern */}
              <div
                className="pointer-events-none absolute -inset-[100%] -z-10 h-[300%] w-[300%] opacity-[0.4] dark:opacity-[0.3]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.2' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter2)' opacity='1'/%3E%3C/svg%3E")`,
                  backgroundSize: "100px 100px",
                  backgroundRepeat: "repeat",
                  opacity: patternOpacity,
                  mixBlendMode: "multiply",
                  maskImage: maskStyle !== "none" ? maskStyle : undefined,
                  WebkitMaskImage: maskStyle !== "none" ? maskStyle : undefined,
                  animation: "grain 0.25s steps(10) infinite reverse",
                  transform: "rotate(180deg)",
                }}
              />
            </>
          ) : (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 size-full"
              style={{
                opacity: patternOpacity ?? 0.15,
                maskImage: maskStyle !== "none" ? maskStyle : undefined,
                WebkitMaskImage: maskStyle !== "none" ? maskStyle : undefined,
              }}
            >
              <defs>
                {pattern === "grid" && (
                  <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
                    <path
                      d={`M.5 ${size}V.5H${size}`}
                      fill="none"
                      stroke="currentColor"
                      className="stroke-muted-foreground"
                    />
                  </pattern>
                )}
                {pattern === "diagonal" && (
                  <pattern
                    id={patternId}
                    width="4"
                    height="4"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="stroke-muted-foreground"
                    />
                  </pattern>
                )}
                {pattern === "diamond" && (
                  <pattern
                    id={patternId}
                    width={size}
                    height={size}
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <path
                      d={`M.5 ${size}V.5H${size}`}
                      fill="none"
                      stroke="currentColor"
                      className="stroke-muted-foreground"
                    />
                  </pattern>
                )}
              </defs>
              <rect width="100%" height="100%" strokeWidth="0" fill={`url(#${patternId})`} />
            </svg>
          ))}

        {/* Corner decorations */}
        {(corners === "dots" || corners === "dots-accent") && (
          <>
            <div
              className={cn(
                "absolute -top-[4.5px] -left-[4.5px] z-10 size-2 rotate-45 rounded-[1px] border bg-background",
                corners === "dots-accent" ? "border-primary bg-primary/20" : "border-border",
              )}
            />
            <div
              className={cn(
                "absolute -top-[4.5px] -right-[4.5px] z-10 size-2 rotate-45 rounded-[1px] border bg-background",
                corners === "dots-accent" ? "border-primary bg-primary/20" : "border-border",
              )}
            />
            <div
              className={cn(
                "absolute -bottom-[4.5px] -left-[4.5px] z-10 size-2 rotate-45 rounded-[1px] border bg-background",
                corners === "dots-accent" ? "border-primary bg-primary/20" : "border-border",
              )}
            />
            <div
              className={cn(
                "absolute -bottom-[4.5px] -right-[4.5px] z-10 size-2 rotate-45 rounded-[1px] border bg-background",
                corners === "dots-accent" ? "border-primary bg-primary/20" : "border-border",
              )}
            />
          </>
        )}

        {(corners === "crosshairs" || corners === "crosshairs-accent") && (
          <>
            {/* Top-left corner mark - L shape with 5px gap - THICKER */}
            <div
              className={cn(
                "absolute -top-[5px] -left-[5px] w-5 h-[2px] z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />
            <div
              className={cn(
                "absolute -top-[5px] -left-[5px] w-[2px] h-5 z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />

            {/* Top-right corner mark - L shape with 5px gap - THICKER */}
            <div
              className={cn(
                "absolute -top-[5px] -right-[5px] w-5 h-[2px] z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />
            <div
              className={cn(
                "absolute -top-[5px] -right-[5px] w-[2px] h-5 z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />

            {/* Bottom-left corner mark - L shape with 5px gap - THICKER */}
            <div
              className={cn(
                "absolute -bottom-[5px] -left-[5px] w-5 h-[2px] z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />
            <div
              className={cn(
                "absolute -bottom-[5px] -left-[5px] w-[2px] h-5 z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />

            {/* Bottom-right corner mark - L shape with 5px gap - THICKER */}
            <div
              className={cn(
                "absolute -bottom-[5px] -right-[5px] w-5 h-[2px] z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />
            <div
              className={cn(
                "absolute -bottom-[5px] -right-[5px] w-[2px] h-5 z-20",
                corners === "crosshairs-accent" ? "bg-primary" : "bg-border",
              )}
            />
          </>
        )}

        {children}
      </div>
    )
  },
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
