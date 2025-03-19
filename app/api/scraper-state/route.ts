import { NextResponse } from "next/server"
import { getScraperState, saveScraperState, updateSeenProductIds } from "@/actions/scraper-state"

// GET endpoint to retrieve state
export async function GET() {
  try {
    const state = await getScraperState()
    return NextResponse.json(state)
  } catch (error) {
    console.error("Error getting scraper state:", error)
    return NextResponse.json({ error: "Failed to get scraper state" }, { status: 500 })
  }
}

// POST endpoint to update state
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Special handling for seenProductIds to ensure they're properly merged
    if (data.seenProductIds) {
      await updateSeenProductIds(data.seenProductIds)
      // Remove seenProductIds from the data object to prevent overwriting them
      delete data.seenProductIds
    }

    const success = await saveScraperState(data)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: "Failed to save state" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error updating scraper state:", error)
    return NextResponse.json({ error: "Failed to update scraper state" }, { status: 500 })
  }
}

