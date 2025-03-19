"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Filter, SortAsc, SortDesc } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

export function ProductsFilter() {
  const router = useRouter()
  const [daysBack, setDaysBack] = useState(7)
  const [sortBy, setSortBy] = useState("newest")
  const [mounted, setMounted] = useState(false)

  // Use useEffect to safely access searchParams after component mounts
  useEffect(() => {
    // Get URL parameters after component mounts
    const params = new URLSearchParams(window.location.search)
    const daysParam = params.get("days")
    const sortParam = params.get("sort")

    if (daysParam) {
      setDaysBack(Number.parseInt(daysParam))
    }

    if (sortParam) {
      setSortBy(sortParam)
    }

    setMounted(true)
  }, [])

  const handleApplyFilters = () => {
    const params = new URLSearchParams(window.location.search)
    params.set("days", daysBack.toString())
    params.set("sort", sortBy)
    router.push(`/?${params.toString()}`)
  }

  // Don't render anything until after client-side hydration
  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-muted/40 p-4 rounded-lg">
      <div className="w-full sm:w-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="timeRange" className="text-sm font-medium">
            Time Range: {daysBack} days
          </Label>
          <span className="text-xs text-muted-foreground">{daysBack === 1 ? "Today" : `Last ${daysBack} days`}</span>
        </div>
        <Slider
          id="timeRange"
          value={[daysBack]}
          min={1}
          max={90}
          step={1}
          onValueChange={(value) => setDaysBack(value[0])}
          className="w-full sm:w-[200px]"
          aria-label="Time Range"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 w-full sm:w-auto justify-between"
              aria-label="Sort options"
            >
              <div className="flex items-center gap-1">
                <Filter size={14} />
                <span>Sort By: {sortBy === "newest" ? "Newest First" : "Most Popular"}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort Products</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
              <DropdownMenuRadioItem value="newest" className="flex items-center gap-1">
                <SortDesc size={14} />
                <span>Newest First</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="popular" className="flex items-center gap-1">
                <SortAsc size={14} />
                <span>Most Popular</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" onClick={handleApplyFilters}>
          Apply Filters
        </Button>
      </div>
    </div>
  )
}

