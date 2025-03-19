"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ModeToggle } from "@/components/mode-toggle"
import { Home, BarChart3, Settings, Database } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded-md">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-bold text-lg">PH Scraper</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            <Link
              href="/"
              className={`text-sm font-medium ${pathname === "/" ? "text-foreground" : "text-muted-foreground"} hover:text-foreground transition-colors flex items-center gap-1`}
            >
              <Home size={16} />
              <span>Home</span>
            </Link>
            <Link
              href="/analytics"
              className={`text-sm font-medium ${pathname === "/analytics" ? "text-foreground" : "text-muted-foreground"} hover:text-foreground transition-colors flex items-center gap-1`}
            >
              <BarChart3 size={16} />
              <span>Analytics</span>
            </Link>
            <Link
              href="/settings"
              className={`text-sm font-medium ${pathname === "/settings" ? "text-foreground" : "text-muted-foreground"} hover:text-foreground transition-colors flex items-center gap-1`}
            >
              <Settings size={16} />
              <span>Settings</span>
            </Link>
            <Link
              href="/contact-extraction"
              className={`text-sm font-medium ${pathname === "/contact-extraction" ? "text-foreground" : "text-muted-foreground"} hover:text-foreground transition-colors flex items-center gap-1`}
            >
              <Database size={16} />
              <span>Contact Extraction</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}

