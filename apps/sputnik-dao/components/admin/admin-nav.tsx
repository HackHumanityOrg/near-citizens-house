"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@near-citizens/ui"
import { LayoutDashboard, UserPlus, FileText, Settings } from "lucide-react"

const navItems = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/members",
    label: "Add Citizen",
    icon: UserPlus,
  },
  {
    href: "/admin/proposals",
    label: "Create Proposal",
    icon: FileText,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
  },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 border-r bg-muted/30 p-4 min-h-[calc(100vh-4rem)]">
      <h2 className="font-semibold text-lg mb-4 px-2">Admin Panel</h2>
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
