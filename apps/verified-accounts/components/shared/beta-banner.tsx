"use client"

import { useState } from "react"

const BANNER_COLORS = [
  // From screenshot
  { name: "Teal", color: "#00C9A7" },         // Current/brand color
  { name: "Amber", color: "#F59E0B" },        // Classic warning - recommended
  { name: "Deep Gold", color: "#845309" },    // Muted warning, professional
  { name: "Warm Orange", color: "#EA580C" },  // Attention-grabbing, common for beta
  { name: "Purple", color: "#7C3AED" },       // Labs/experimental (Google, Discord style)
  { name: "Slate", color: "#475569" },        // Neutral, subtle
  // Additional beta warning colors
  { name: "Crimson", color: "#DC2626" },      // Urgent warning
  { name: "Indigo", color: "#4F46E5" },       // Labs alternative
  { name: "Rust", color: "#B91C1C" },         // Earthy warning
  { name: "Bronze", color: "#A16207" },       // Warm professional
  { name: "Violet", color: "#8B5CF6" },       // Lighter experimental
  { name: "Charcoal", color: "#374151" },     // Dark neutral
] as const

export function BetaBanner() {
  const [selectedColor, setSelectedColor] = useState(BANNER_COLORS[1].color) // Default to Amber (recommended)

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] w-full text-white py-1.5 flex items-center justify-center gap-3"
      style={{ backgroundColor: selectedColor }}
    >
      <span className="text-sm font-bold tracking-wide">Beta testing on Testnet</span>
      <div className="flex items-center gap-1">
        {BANNER_COLORS.map((option) => (
          <button
            key={option.color}
            onClick={() => setSelectedColor(option.color)}
            className={`w-3 h-3 rounded-sm transition-all ${
              selectedColor === option.color
                ? "ring-2 ring-white ring-offset-1 scale-110"
                : "opacity-70 hover:opacity-100"
            }`}
            style={{
              backgroundColor: option.color,
              ringOffsetColor: selectedColor,
            }}
            title={option.name}
            aria-label={`Change banner color to ${option.name}`}
          />
        ))}
      </div>
    </div>
  )
}
